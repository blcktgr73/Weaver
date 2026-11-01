import { describe, expect, it } from 'vitest';
import { loadWorkspace, placeIssue } from '@palab/weaver-markdown';
import type { Fetch, FetchFn, ProjectCard } from '@palab/weaver-github';
import { linkTaskLine, planDraftTask, planLinkIssue, planReconcile, type FilesContext, type System } from '../src';

const REQUIREMENT = '---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nrepository: me/Weaver\n---\n\n## Tasks\n\n- `TASK-011` Card eleven\n';
const TASK_11 = '---\nid: TASK-011\ntype: task\ntitle: Card eleven\nrequirement: REQ-001\nstatus: draft\nrepository: me/Weaver\nassignee_type: agent\n---\n\n# TASK-011 Card eleven\n';
const FILES = [
  { path: 'requirements/REQ-001.md', text: REQUIREMENT },
  { path: 'tasks/TASK-011.md', text: TASK_11 },
];
const loaded = (files = FILES) => loadWorkspace(files).artifacts;

const card = (n: number, extra: Partial<ProjectCard> = {}): ProjectCard => ({
  repository: 'me/Weaver',
  number: n,
  title: `Card ${n}`,
  url: `https://github.com/me/Weaver/issues/${n}`,
  state: 'open',
  labels: ['status:ready'],
  assignees: [],
  placement: placeIssue({ state: 'open', labels: ['status:ready'] }),
  ...extra,
});

/** A fake `git`, `gh`, and file system that record what was run and written. */
function world(options: { openBranches?: string[]; texts?: Record<string, string> } = {}) {
  const ran: string[] = [];
  const written = new Map<string, string>();
  const texts: Record<string, string> = { 'REQ-001.md': REQUIREMENT, 'TASK-011.md': TASK_11, ...options.texts };
  const system: System = {
    run: async (command, args) => {
      ran.push(`${command} ${args.join(' ')}`);
      if (command === 'gh' && args[0] === 'pr' && args[1] === 'list') return JSON.stringify((options.openBranches ?? []).map((headRefName) => ({ headRefName })));
      if (command === 'gh' && args[0] === 'repo') return 'main\n';
      if (args[0] === 'rev-parse') return '/work\n';
      return '';
    },
    tempDir: async () => '/tmp/work',
    readText: async (file) => Object.entries(texts).find(([name]) => file.endsWith(name))?.[1],
    writeFile: async (file, text) => void written.set(file.replace(/\\/g, '/'), text),
  };
  return { system, ran, written };
}

/** GitHub: creating an Issue answers number 77, reading an Issue answers `body`, the Project answers fixed ids. */
function github(body = '') {
  const calls: string[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push(`${init.method} ${url}`);
    if (url.includes('/repos/')) return { ok: true, status: 201, json: async () => ({ number: 77, html_url: 'https://github.com/me/Weaver/issues/77' }) };
    const query = JSON.parse(init.body).query as string;
    calls.push(query.slice(0, 40));
    if (query.includes('resource(url')) return { ok: true, status: 200, json: async () => ({ data: { repositoryOwner: { projectV2: { id: 'P' } }, resource: { id: 'I' } } }) };
    return { ok: true, status: 200, json: async () => ({ data: { addProjectV2ItemById: { item: { id: 'X' } } } }) };
  };
  const fetchFn = (async (url: string, init?: { method?: string }) => {
    if ((init?.method ?? 'GET') === 'GET' && /\/issues\/\d+$/.test(url)) return { ok: true, status: 200, json: async () => ({ body }) };
    return { ok: true, status: 201, json: async () => ({ number: 77, html_url: 'https://github.com/me/Weaver/issues/77' }) };
  }) as unknown as FetchFn;
  return { fetch, fetchFn, calls };
}

const context = (w: ReturnType<typeof world>, g: ReturnType<typeof github>): FilesContext => ({
  token: 't',
  login: 'me',
  locale: 'en',
  project: { owner: 'me', number: 1 },
  system: w.system,
  root: '/work',
  taskDirectory: 'tasks',
  fetch: g.fetch,
  fetchFn: g.fetchFn,
  usedTexts: async () => [],
  planned: [],
});

const runAll = async (actions: { run(): Promise<void> }[]) => {
  for (const action of actions) await action.run();
};

describe('linkTaskLine', () => {
  it('adds the Issue link to the line of the task that has none', () => {
    expect(linkTaskLine(REQUIREMENT, 'TASK-011', 77, 'https://github.com/me/Weaver/issues/77')).toContain('- `TASK-011` Card eleven — [GitHub Issue #77](https://github.com/me/Weaver/issues/77)\n');
  });

  it('leaves a line that already has a link, a task that is not listed, and the line endings alone', () => {
    const linked = '## Tasks\n\n- `TASK-011` Card — [GitHub Issue #5](https://github.com/me/Weaver/issues/5)\n';
    expect(linkTaskLine(linked, 'TASK-011', 77, 'u')).toBe(linked);
    expect(linkTaskLine(REQUIREMENT, 'TASK-099', 77, 'u')).toBe(REQUIREMENT);
    expect(linkTaskLine(REQUIREMENT.replace(/\n/g, '\r\n'), 'TASK-011', 77, 'https://github.com/me/Weaver/issues/77')).toContain('\r\n');
  });
});

describe('planLinkIssue: a task file without an Issue', () => {
  const [requirement, task] = [loaded().find((a) => a.kind === 'requirement'), loaded().find((a) => a.kind === 'task')];
  if (requirement?.kind !== 'requirement' || task?.kind !== 'task') throw new Error('fixture');

  it('creates the Issue, puts it on the Project, and opens a pull request that links it in the task file and the requirement', async () => {
    const w = world();
    const g = github();
    const actions = (await planLinkIssue(context(w, g), task, requirement, [])) ?? [];
    expect(actions.map((a) => a.kind)).toEqual(['issue.create', 'project.add', 'files.pull-request']);
    expect(actions[2].dependsOn).toEqual([actions[0]]);
    // Planning changes nothing.
    expect(g.calls).toEqual([]);
    expect(w.written.size).toBe(0);

    await runAll(actions);
    expect(g.calls.some((c) => c.startsWith('POST') && c.endsWith('/repos/me/Weaver/issues'))).toBe(true);
    expect(w.ran).toContain('git worktree add -b docs/task-011-link-issue /tmp/work origin/main');
    expect(w.ran.some((c) => c.startsWith('git push -u origin docs/task-011-link-issue'))).toBe(true);
    expect(w.ran.some((c) => c.startsWith('gh pr create --repo me/Weaver --head docs/task-011-link-issue --base main'))).toBe(true);
    const taskText = [...w.written].find(([file]) => file.endsWith('tasks/TASK-011.md'))?.[1];
    expect(taskText).toContain('issue: https://github.com/me/Weaver/issues/77');
    expect(taskText).toContain('# TASK-011 Card eleven');
    const requirementText = [...w.written].find(([file]) => file.endsWith('REQ-001.md'))?.[1];
    expect(requirementText).toContain('[GitHub Issue #77]');
  });

  it('links the Issue the Project already has for the task, and creates none', async () => {
    const w = world();
    const g = github();
    const actions = (await planLinkIssue(context(w, g), task, requirement, [card(31, { title: '[TASK-011] Card eleven', taskId: 'TASK-011' })])) ?? [];
    expect(actions.map((a) => a.kind)).toEqual(['files.pull-request']);
    await runAll(actions);
    expect(g.calls).toEqual([]);
    expect([...w.written].find(([file]) => file.endsWith('tasks/TASK-011.md'))?.[1]).toContain('issue: https://github.com/me/Weaver/issues/31');
  });

  it('offers nothing when the same pull request is already open, or the repository is unknown', async () => {
    const open = world({ openBranches: ['docs/task-011-link-issue'] });
    expect(await planLinkIssue(context(open, github()), task, requirement, [])).toBeUndefined();
    const unknown = { ...task, repository: undefined };
    expect(await planLinkIssue(context(world(), github()), unknown, { ...requirement, repository: undefined }, [])).toBeUndefined();
  });

  it('removes the worktree even when the pull request cannot be opened, and says why', async () => {
    const w = world({ texts: { 'TASK-011.md': 'no front matter here\n' } });
    const actions = (await planLinkIssue(context(w, github()), task, requirement, [card(31, { taskId: 'TASK-011' })])) ?? [];
    await expect(runAll(actions)).rejects.toThrow();
    expect(w.ran.some((c) => c.startsWith('git worktree remove --force /tmp/work'))).toBe(true);
    expect(w.ran.some((c) => c.startsWith('git push'))).toBe(false);
  });
});

describe('planDraftTask: a card without a task file', () => {
  const artifacts = loaded();

  it('drafts the task file and lists it under the requirement the Issue names', async () => {
    const w = world();
    const g = github('Part of REQ-001.');
    const actions = (await planDraftTask(context(w, g), card(50, { title: 'Add a thing', assignees: ['blckt'] }), artifacts)) ?? [];
    expect(actions.map((a) => a.kind)).toEqual(['files.pull-request']);
    expect(g.calls).toEqual([]);
    await runAll(actions);
    const draft = [...w.written].find(([file]) => file.endsWith('tasks/TASK-012.md'))?.[1];
    expect(draft).toContain('title: Add a thing');
    expect(draft).toContain('requirement: REQ-001');
    expect(draft).toContain('issue: https://github.com/me/Weaver/issues/50');
    expect(draft).toContain('assignee: blckt');
    expect([...w.written].find(([file]) => file.endsWith('REQ-001.md'))?.[1]).toContain('- `TASK-012` Add a thing — [GitHub Issue #50](https://github.com/me/Weaver/issues/50)');
    expect(w.ran.some((c) => c.startsWith('git worktree add -b docs/task-012-draft-from-issue'))).toBe(true);
  });

  it('keeps the task ID in the title of the Issue, and never gives one number to two drafts', async () => {
    const w = world();
    const g = github('REQ-001');
    const ctx = context(w, g);
    const withId = (await planDraftTask(ctx, card(60, { title: '[TASK-040] Has an id', taskId: 'TASK-040' }), artifacts)) ?? [];
    const first = (await planDraftTask(ctx, card(61, { title: 'No id one' }), artifacts)) ?? [];
    const second = (await planDraftTask(ctx, card(62, { title: 'No id two' }), artifacts)) ?? [];
    expect(withId[0].summary.args).toMatchObject({ task: 'TASK-040', path: 'tasks/TASK-040.md' });
    // The ID the first card named is taken, so the numbers go on after it.
    expect(first[0].summary.args).toMatchObject({ task: 'TASK-041' });
    expect(second[0].summary.args).toMatchObject({ task: 'TASK-042' });
  });

  it('stays a report when no requirement can be named, or it belongs to another repository', async () => {
    expect(await planDraftTask(context(world(), github('no requirement here')), card(50), artifacts)).toBeUndefined();
    expect(await planDraftTask(context(world(), github('REQ-999')), card(50), artifacts)).toBeUndefined();
    expect(await planDraftTask(context(world(), github('REQ-001')), card(50, { repository: 'me/Other' }), artifacts)).toBeUndefined();
  });

  it('stays a report for a title that cannot be written into front matter', async () => {
    expect(await planDraftTask(context(world(), github('REQ-001')), card(50, { title: 'Fix: the thing' }), artifacts)).toBeUndefined();
  });
});

describe('planReconcile with the file fixes', () => {
  const taskNoIssue = loaded();
  const base = (files?: FilesContext) => ({
    token: 't',
    login: 'me',
    locale: 'en' as const,
    project: { owner: 'me', number: 1 },
    repositories: ['me/Weaver'],
    cards: [card(50, { title: 'Orphan card' })],
    artifacts: taskNoIssue,
    pulls: [],
    now: new Date('2026-11-01T00:00:00Z'),
    ...(files ? { files } : {}),
  });

  it('turns both mismatches into pull-request actions when it can, and keeps them as reports when it cannot', async () => {
    const w = world();
    const g = github('REQ-001');
    const withFiles = await planReconcile(base(context(w, g)));
    expect(withFiles.actions.map((a) => a.kind).sort()).toEqual(['files.pull-request', 'files.pull-request', 'issue.create', 'project.add']);
    expect(withFiles.reports.map((r) => r.kind)).not.toContain('task-without-issue');
    expect(withFiles.reports.map((r) => r.kind)).not.toContain('card-without-file');

    const without = await planReconcile(base());
    expect(without.actions).toEqual([]);
    expect(without.reports.map((r) => r.kind).sort()).toEqual(['card-without-file', 'task-without-issue']);
  });
});
