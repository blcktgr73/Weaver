import * as path from 'path';
import {
  Contributor,
  formatNotice,
  Locale,
  MessageArgs,
  MessageKey,
  parseConfig,
  parseProjectRef,
  serializeConfig,
  t,
  type UserConfig,
} from '@palab/weaver-markdown';
import { listProjects, readProject, summarizeProject, type ProjectSummary } from '@palab/weaver-github';
import { EXIT, SCHEMA, type Deps } from './contract';
import { configPath } from './setup';

/**
 * `3`, `1,4`, `2-5`, `all`, or nothing. Returns the numbers from 1 to `max` in order and without
 * repeats; undefined when the text is not such a list or a number is out of range.
 */
export function parseSelection(text: string, max: number): number[] | undefined {
  const wanted = text.trim().toLowerCase();
  if (wanted === '') return [];
  if (wanted === 'all') return Array.from({ length: max }, (_, i) => i + 1);
  const picked = new Set<number>();
  for (const part of wanted.split(/[\s,]+/).filter(Boolean)) {
    const range = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!range) return undefined;
    const from = Number(range[1]);
    const to = range[2] === undefined ? from : Number(range[2]);
    if (from < 1 || to > max || from > to) return undefined;
    for (let n = from; n <= to; n++) picked.add(n);
  }
  return [...picked].sort((a, b) => a - b);
}

export { parseProjectRef };

const same = (a: { owner: string; number: number }, b: { owner: string; number: number }): boolean => a.owner.toLowerCase() === b.owner.toLowerCase() && a.number === b.number;

/**
 * The setup in a terminal (DEC-014): sign-in, the Project, the repositories to leave out, roster
 * candidates and agents, then the file. It asks, shows what it will write, and writes only after a yes.
 * Running it again starts from the configuration that is there.
 */
export async function runInit(deps: Deps, locale: Locale, wantsText: boolean): Promise<number> {
  const say = (key: MessageKey, args?: MessageArgs): string => t(key, locale, args);
  const note = (text: string): void => deps.err(`${text}\n`);
  const fail = (code: number, key: MessageKey, args?: MessageArgs): number => {
    const message = say(key, args);
    if (wantsText) deps.err(`${message}\n`);
    else deps.out(`${JSON.stringify({ schema: SCHEMA, error: { code: key, message } })}\n`);
    return code;
  };

  if (!deps.interactive) return fail(EXIT.needsTerminal, 'init.not-interactive');
  const token = await deps.token();
  if (!token) return fail(EXIT.failed, 'cli.no-token');

  const file = configPath(deps.env);
  const existingText = await deps.readText(file);
  const existing: UserConfig | undefined = existingText?.trim() ? parseConfig(file, existingText).config : undefined;

  // 1. The Project.
  const listed = await listProjects(token, deps.fetch);
  if (!listed.ok) return fail(EXIT.failed, 'init.failed', { detail: formatNotice(listed.error, locale) });
  const projects: ProjectSummary[] = listed.projects;
  if (listed.organizationsSkipped) note(say('init.organizations-skipped'));
  if (projects.length) {
    note(say('init.projects-title'));
    projects.forEach((p, i) => note(say('init.project-line', { index: i + 1, owner: p.owner, number: p.number, title: p.title, items: p.items, current: existing && same(existing.project, p) ? say('init.current') : '' })));
  } else {
    note(say('init.no-projects'));
  }

  let project: { owner: string; number: number } | undefined;
  while (!project) {
    const answer = (await deps.prompt(say('init.project-prompt'))).trim();
    if (answer === '' && existing) project = existing.project;
    else if (/^\d+$/.test(answer) && Number(answer) >= 1 && Number(answer) <= projects.length) project = { owner: projects[Number(answer) - 1].owner, number: projects[Number(answer) - 1].number };
    else project = parseProjectRef(answer);
    if (!project) note(say('init.project-bad', { text: answer }));
  }

  // 2. The repositories on it.
  note(say('init.reading', { owner: project.owner, number: project.number }));
  const read = await readProject(token, project, undefined, deps.fetch);
  if (!read.ok) return fail(EXIT.failed, 'init.failed', { detail: formatNotice(read.error, locale) });
  const overview = summarizeProject(read.read);

  const kept = new Set(existing?.repositories?.map((r) => r.repository.toLowerCase()));
  const wasLeftOut = (repository: string): boolean => existing?.repositories !== undefined && !kept.has(repository.toLowerCase());
  note(say('init.repositories-title'));
  overview.repositories.forEach((r, i) => note(say('init.repository-line', { index: i + 1, repository: r.repository, cards: r.cards, left: wasLeftOut(r.repository) ? say('init.left-out') : '' })));

  let leftOut: number[] | undefined;
  while (leftOut === undefined) {
    const answer = await deps.prompt(say('init.repositories-prompt'));
    // Enter keeps what the existing configuration had, or everything the first time.
    leftOut = answer.trim() === '' && existing?.repositories ? overview.repositories.flatMap((r, i) => (wasLeftOut(r.repository) ? [i + 1] : [])) : parseSelection(answer, overview.repositories.length);
    if (leftOut === undefined) note(say('init.selection-bad', { text: answer.trim(), max: overview.repositories.length }));
  }
  const repositories = leftOut.length === 0 ? undefined : overview.repositories.filter((_, i) => !leftOut.includes(i + 1)).map((r) => ({ repository: r.repository }));

  // 3. The roster: who is already in it, people found on the cards, and agents by hand.
  const contributors: Contributor[] = [...(existing?.roster?.contributors ?? [])];
  const known = new Set(contributors.flatMap((c) => [c.id.toLowerCase(), c.github?.toLowerCase() ?? '']));
  const candidates = overview.assignees.filter((a) => !known.has(a.login.toLowerCase()));
  if (candidates.length) {
    note(say('init.assignees-title'));
    candidates.forEach((a, i) => note(say('init.assignee-line', { index: i + 1, login: a.login, cards: a.cards })));
    let chosen: number[] | undefined;
    while (chosen === undefined) {
      const answer = await deps.prompt(say('init.assignees-prompt'));
      chosen = parseSelection(answer, candidates.length);
      if (chosen === undefined) note(say('init.selection-bad', { text: answer.trim(), max: candidates.length }));
    }
    for (const n of chosen) contributors.push({ id: candidates[n - 1].login, kind: 'human', github: candidates[n - 1].login });
  }
  for (;;) {
    const id = (await deps.prompt(say('init.agent-prompt'))).trim();
    if (id === '') break;
    if (contributors.some((c) => c.id.toLowerCase() === id.toLowerCase())) {
      note(say('init.agent-duplicate', { id }));
      continue;
    }
    const tool = (await deps.prompt(say('init.agent-tool-prompt', { id }))).trim();
    const reach = (await deps.prompt(say('init.agent-reach-prompt', { id }))).trim();
    contributors.push({ id, kind: 'agent', ...(tool ? { tool } : {}), ...(reach ? { reach } : {}) });
  }

  // 4. Show it, and write it only after a yes.
  const config: UserConfig = { project, ...(repositories ? { repositories } : {}), ...(contributors.length ? { roster: { contributors } } : {}) };
  const text = serializeConfig(config);
  note(say('init.preview-title', { path: file }));
  note(text);
  const backup = `${file}.bak`;
  if (existingText?.trim()) note(say('init.replace-note', { backup }));
  if (!(await deps.ask(say('init.write-confirm')))) {
    note(say('init.cancelled'));
    deps.out(`${JSON.stringify({ schema: SCHEMA, status: 'cancelled', path: file })}\n`);
    return EXIT.declined;
  }
  if (existingText?.trim()) await deps.system.writeFile(backup, existingText);
  await deps.system.writeFile(file, text);
  note(say('init.written', { path: path.normalize(file) }));
  deps.out(`${JSON.stringify({ schema: SCHEMA, status: 'written', path: file })}\n`);
  return EXIT.ok;
}
