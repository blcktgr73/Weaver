import * as path from 'path';
import {
  Artifact,
  formatNotice,
  Locale,
  LOCALES,
  loadWorkspace,
  MessageArgs,
  MessageKey,
  parseFabric,
  SourceFile,
  taskIdsOfPull,
  t,
} from '@palab/weaver-markdown';
import { Fetch, readMergedPulls, readProject } from '@palab/weaver-github';
import { Args, parseArgs } from './args';
import { CliCard, findCards, toCliCards } from './cards';

/** The version of the JSON that every command prints. A change that breaks a reader raises it. */
export const SCHEMA = 1;

export const EXIT = { ok: 0, failed: 1, usage: 2, notFound: 3 } as const;

/** Everything the commands touch outside the process, so a test can replace it. */
export interface Deps {
  cwd: string;
  env: Record<string, string | undefined>;
  out(text: string): void;
  err(text: string): void;
  /** The GitHub token of the signed-in `gh` login, or undefined. */
  token(): Promise<string | undefined>;
  fetch?: Fetch;
  files(root: string): Promise<SourceFile[]>;
  readText(file: string): Promise<string | undefined>;
  now(): Date;
}

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
  if (args.command !== 'list' && args.command !== 'show') return fail(EXIT.usage, 'cli.unknown-command', { command: args.command });
  if (args.command === 'show' && args.positional.length === 0) {
    return fail(EXIT.usage, 'cli.missing-argument', { command: 'show', argument: 'a card' });
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

  const artifacts: Artifact[] = loadWorkspace(await deps.files(root)).artifacts;
  const all = toCliCards(read.read.cards, artifacts, deps.now());

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
