import * as path from 'path';
import {
  Artifact,
  RequirementArtifact,
  formatNotice,
  Locale,
  LOCALES,
  loadWorkspace,
  MessageArgs,
  MessageKey,
  parseFabric,
  taskIdsOfPull,
  t,
} from '@palab/weaver-markdown';
import { readMergedPulls, readProject, type FetchFn } from '@palab/weaver-github';
import { executeActions, finishActions, parseApproved, PlannedAction, Skipped } from './actions';
import { Args, parseArgs } from './args';
import { parseColumn, planCardMove, planEvidenceAttach } from './cardActions';
import { CliCard, findCards, toCliCards } from './cards';
import { Deps, EXIT, SCHEMA } from './contract';
import { planProjectAdd } from './projectAdd';
import { nextTaskNumber, planTaskCreate, usedTaskTexts } from './taskCreate';

export { Deps, EXIT, SCHEMA } from './contract';

export async function run(argv: readonly string[], deps: Deps): Promise<number> {
  const parsed = parseArgs(argv);
  const wantsText = !('unknown' in parsed) && parsed.flags.has('text');
  const lang = !('unknown' in parsed) && parsed.options.lang ? parsed.options.lang : deps.env.WEAVER_LANG;
  const locale: Locale = (LOCALES as readonly string[]).includes(lang ?? '') ? (lang as Locale) : 'en';
  const say = (key: MessageKey, args?: MessageArgs): string => t(key, locale, args);

  /** A failure is JSON on stdout for an agent, and a sentence on stderr for a person. */
  const report = (code: string, message: string): void => {
    if (wantsText) deps.err(`${message}\n`);
    else deps.out(`${JSON.stringify({ schema: SCHEMA, error: { code, message } })}\n`);
  };
  const fail = (exit: number, key: MessageKey, args?: MessageArgs): number => {
    report(key, say(key, args));
    return exit;
  };

  if ('unknown' in parsed) return fail(EXIT.usage, 'cli.unknown-command', { command: parsed.unknown });
  const args: Args = parsed;
  if (args.flags.has('help') || !args.command) {
    deps.out(`${say('cli.usage')}\n`);
    return args.command || args.flags.has('help') ? EXIT.ok : EXIT.usage;
  }
  if (args.command !== 'list' && args.command !== 'show' && args.command !== 'project' && args.command !== 'task' && args.command !== 'card' && args.command !== 'evidence') return fail(EXIT.usage, 'cli.unknown-command', { command: args.command });
  if (args.command === 'show' && args.positional.length === 0) {
    return fail(EXIT.usage, 'cli.missing-argument', { command: 'show', argument: 'a card' });
  }

  if (args.command === 'project' && (args.positional[0] !== 'add' || args.positional.length < 2)) {
    return fail(EXIT.usage, 'cli.missing-argument', { command: 'project add', argument: 'an Issue address' });
  }

  if (args.command === 'task' && (args.positional[0] !== 'create' || !args.options.title || !args.options.requirement)) {
    return fail(EXIT.usage, 'cli.missing-argument', { command: 'task create', argument: '--title and --requirement' });
  }

  if (args.command === 'card' && (args.positional[0] !== 'move' || args.positional.length < 2 || !args.options.to)) {
    return fail(EXIT.usage, 'cli.missing-argument', { command: 'card move', argument: 'a card and --to <column>' });
  }
  if (args.command === 'evidence' && (args.positional[0] !== 'attach' || args.positional.length < 2 || !args.options.pull)) {
    return fail(EXIT.usage, 'cli.missing-argument', { command: 'evidence attach', argument: 'a card and --pull <number or address>' });
  }

  const root = path.resolve(deps.cwd, args.options.root ?? '.');
  const registry = parseFabric('fabric.yaml', (await deps.readText(path.join(root, 'fabric.yaml'))) ?? '').registry;
  if (!registry) return fail(EXIT.failed, 'cli.no-registry', { root });
  const token = await deps.token();
  if (!token) return fail(EXIT.failed, 'cli.no-token');

  const repositories = registry.repositories.map((r) => r.repository);
  const read = await readProject(token, registry.project, repositories, deps.fetch);
  if (!read.ok) {
    report(read.error.code, formatNotice(read.error, locale));
    return EXIT.failed;
  }

  /** Shows the plan, takes the confirmations, runs what was approved, and prints the result. */
  const confirmAndRun = async (actions: PlannedAction[], skipped: Skipped[] = []): Promise<number> => {
    const results = await executeActions(actions, {
      locale,
      approved: parseApproved(args.options.approve),
      interactive: deps.interactive,
      ask: deps.ask,
      log: deps.log,
      actor: deps.env.WEAVER_ACTOR ?? 'steward',
      onBehalfOf: await deps.login(),
      now: () => deps.now(),
      note: (text) => deps.err(text),
    });
    return finishActions(results, deps, locale, wantsText, skipped);
  };

  if (args.command === 'project') {
    const plan = planProjectAdd(args.positional.slice(1), {
      token,
      project: registry.project,
      repositories,
      onProject: read.read.cards.map((card) => card.url),
      fetch: deps.fetch,
    });
    return confirmAndRun(plan.actions, plan.skipped);
  }

  const artifacts: Artifact[] = loadWorkspace(await deps.files(root)).artifacts;
  if (args.command === 'task') {
    const requirement = artifacts.find((a): a is RequirementArtifact => a.kind === 'requirement' && a.id === args.options.requirement);
    if (!requirement) return fail(EXIT.notFound, 'cli.requirement-not-found', { id: args.options.requirement });
    const title = args.options.title.trim();
    if (!title || /[:\n]/.test(title)) return fail(EXIT.usage, 'cli.bad-title');
    const wanted = args.options.repository ?? requirement.repository ?? '';
    const repository = repositories.find((name) => name.toLowerCase() === wanted.toLowerCase());
    if (!repository) return fail(EXIT.usage, 'cli.repository-unregistered', { repository: wanted });
    const criteria = (args.options.criteria ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
    const unknown = criteria.find((c) => !requirement.criteria.some((known) => known.id === c));
    if (unknown) return fail(EXIT.usage, 'cli.unknown-criterion', { criterion: unknown, requirement: requirement.id });
    const assigneeType = args.options['assignee-type'] ?? 'agent';
    if (assigneeType !== 'human' && assigneeType !== 'agent') return fail(EXIT.usage, 'cli.bad-assignee-type');
    const firstTask = artifacts.find((a) => a.kind === 'task');
    const actions = planTaskCreate({
      token,
      login: await deps.login(),
      locale,
      project: registry.project,
      requirement,
      repository,
      title,
      criteria,
      assigneeType,
      assignee: args.options.assignee,
      area: args.options.area,
      number: nextTaskNumber(await usedTaskTexts(artifacts, read.read.cards, repository, deps.system)),
      taskDirectory: firstTask ? path.posix.dirname(firstTask.path) : 'docs/tasks',
      root,
      system: deps.system,
      fetch: deps.fetch,
    });
    return confirmAndRun(actions);
  }

  const all = toCliCards(read.read.cards, artifacts, deps.now());

  if (args.command === 'card' || args.command === 'evidence') {
    const ref = args.positional[1];
    const matches = findCards(all, ref);
    if (matches.length === 0) return fail(EXIT.notFound, 'cli.not-found', { ref });
    if (matches.length > 1) return fail(EXIT.usage, 'cli.ambiguous', { ref, matches: matches.map((c) => `${c.repository}#${c.number}`) });
    const card = matches[0];
    const fetchFn = deps.fetch as unknown as FetchFn | undefined;
    let planned;
    if (args.command === 'card') {
      const column = parseColumn(args.options.to);
      if (!column) return fail(EXIT.usage, 'cli.bad-column', { column: args.options.to });
      const task = card.task?.path ? artifacts.find((a) => a.kind === 'task' && a.path === card.task?.path) : undefined;
      planned = await planCardMove({ token, card, column, evidenceException: task?.kind === 'task' && Boolean(task.evidenceException), locale, fetchFn });
    } else {
      planned = await planEvidenceAttach({ token, login: await deps.login(), card, pull: args.options.pull, locale, fetchFn });
    }
    if (!planned.ok) return fail(EXIT.usage, planned.refusal.code, planned.refusal.args);
    return confirmAndRun(planned.actions);
  }

  if (args.command === 'list') {
    const repository = args.options.repository?.toLowerCase();
    const column = args.options.column?.toLowerCase();
    const cards = all.filter((c) => (!repository || c.repository.toLowerCase() === repository) && (!column || c.column.toLowerCase() === column));
    if (wantsText) {
      deps.out(cards.map(textLine).join('\n') + (cards.length ? '\n' : ''));
    } else {
      const project = { owner: registry.project.owner, number: registry.project.number, title: read.read.title };
      deps.out(`${JSON.stringify({ schema: SCHEMA, project, cards, skipped: read.read.skipped })}\n`);
    }
    return EXIT.ok;
  }

  const ref = args.positional[0];
  const matches = findCards(all, ref);
  if (matches.length === 0) return fail(EXIT.notFound, 'cli.not-found', { ref });
  if (matches.length > 1) return fail(EXIT.usage, 'cli.ambiguous', { ref, matches: matches.map((c) => `${c.repository}#${c.number}`) });
  const card = matches[0];

  const task = card.task?.path ? artifacts.find((a) => a.kind === 'task' && a.path === card.task?.path) : undefined;
  const requirement = card.requirement ? artifacts.find((a) => a.kind === 'requirement' && a.path === card.requirement?.path) : undefined;
  const merged = await readMergedPulls(token, card.repository, 50, deps.fetch);
  const pulls = merged.ok
    ? merged.pulls
        .filter(
          (pull) =>
            pull.repository.toLowerCase() === card.repository.toLowerCase() &&
            (pull.closes.includes(card.number) || (card.task !== undefined && taskIdsOfPull(pull).includes(card.task.id))),
        )
        .map((pull) => ({ number: pull.number, title: pull.title, url: pull.url, closes: pull.closes.includes(card.number) }))
    : null;
  const warnings = merged.ok ? [] : [formatNotice(merged.error, locale)];

  const detail = {
    schema: SCHEMA,
    card,
    task:
      task?.kind === 'task'
        ? { id: task.id, title: task.title, path: task.path, status: task.status, assigneeType: task.assigneeType, assignee: task.assignee, criteria: task.criteria, blockers: task.blockers }
        : null,
    requirement:
      requirement?.kind === 'requirement' ? { id: requirement.id, title: requirement.title, path: requirement.path, status: requirement.status } : null,
    pulls,
    warnings,
  };
  if (wantsText) {
    deps.out(`${textLine(card)}\n`);
    if (detail.task) deps.out(`task: ${detail.task.id} ${detail.task.path}\n`);
    if (detail.requirement) deps.out(`requirement: ${detail.requirement.id} ${detail.requirement.path}\n`);
    for (const pull of pulls ?? []) deps.out(`pull: #${pull.number} ${pull.title} ${pull.url}${pull.closes ? ' (closes)' : ''}\n`);
    for (const warning of warnings) deps.err(`${warning}\n`);
  } else {
    deps.out(`${JSON.stringify(detail)}\n`);
  }
  return EXIT.ok;
}

function textLine(card: CliCard): string {
  const marks = card.stale.length ? `  [${card.stale.join(', ')}]` : '';
  return `${card.repository}#${card.number}\t${card.column}\t${card.title}${marks}`;
}
