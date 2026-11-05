import { describe, expect, it } from 'vitest';
import { loadWorkspace, parseProcess, placeIssue, type MergedPull, type TaskContract } from '@palab/weaver-markdown';
import type { FetchFn, ProjectCard } from '@palab/weaver-github';
import { actionId, executeActions, planReconcile, type ExecuteContext, type ReconcileInput } from '../src';

const url = (n: number) => `https://github.com/me/Weaver/issues/${n}`;

const card = (n: number, extra: Partial<ProjectCard> = {}): ProjectCard => {
  const state = extra.state ?? 'open';
  const labels = extra.labels ?? ['task', 'status:in-progress'];
  return {
    repository: 'me/Weaver',
    number: n,
    title: `[TASK-0${n}] Card ${n}`,
    url: url(n),
    state,
    labels,
    assignees: [],
    taskId: `TASK-0${n}`,
    updatedAt: '2026-10-31T00:00:00Z',
    placement: placeIssue({ state, labels }),
    ...extra,
  };
};

const task = (id: string, extra = '') => `---\nid: ${id}\ntype: task\ntitle: ${id} title\nrequirement: REQ-001\nrepository: me/Weaver\nassignee_type: agent\n${extra}---\n`;
const files = {
  'req.md': '---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nrepository: me/Weaver\n---\n\n## Tasks\n\n',
  'TASK-010.md': task('TASK-010', `issue: ${url(10)}\n`),
  'TASK-020.md': task('TASK-020', `issue: ${url(20)}\n`),
  'TASK-030.md': task('TASK-030', `issue: ${url(30)}\n`),
  'TASK-040.md': task('TASK-040', 'status: draft\n'),
  'TASK-041.md': task('TASK-041', 'issue: not-a-url\n'),
};
const artifacts = loadWorkspace(Object.entries(files).map(([path, text]) => ({ path, text }))).artifacts;

/** Only TASK-010, whose card agrees with it. */
const quiet = loadWorkspace([{ path: 'TASK-010.md', text: task('TASK-010', `issue: ${url(10)}\n`) }, { path: 'req.md', text: files['req.md'] }]).artifacts;

const pull = (extra: Partial<MergedPull> = {}): MergedPull => ({
  repository: 'me/Weaver', number: 50, title: 'feat: ten (TASK-010)', url: 'https://github.com/me/Weaver/pull/50', branch: 'feat/task-010', closes: [], ...extra,
});

/** A fetch that answers the comment list of any Issue and records the other calls. */
function rest(comments: unknown = [], status = 200) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const fetchFn = (async (url: string, init?: { method?: string; body?: string }) => {
    calls.push({ method: init?.method ?? 'GET', url, ...(init?.body ? { body: JSON.parse(init.body) } : {}) });
    const ok = status < 400;
    return { ok, status, json: async () => (url.includes('/comments') && (init?.method ?? 'GET') === 'GET' ? comments : {}) };
  }) as unknown as FetchFn;
  return { fetchFn, calls };
}

const input = (overrides: Partial<ReconcileInput> = {}): ReconcileInput => ({
  token: 't',
  login: 'me',
  locale: 'en',
  project: { owner: 'me', number: 1 },
  repositories: ['me/Weaver'],
  cards: [card(10, { boardStatus: 'Todo' }), card(30, { state: 'closed', labels: ['task', 'status:review'], boardStatus: 'Done' })],
  artifacts,
  pulls: [pull()],
  now: new Date('2026-11-01T00:00:00Z'),
  fetchFn: rest().fetchFn,
  ...overrides,
});

describe('planReconcile', () => {
  it('sorts what the Overview reports into actions and a report, following the DEC-012 table', async () => {
    const plan = await planReconcile(input());
    expect(plan.actions.map((a) => `${a.kind} ${a.target}`).sort()).toEqual([
      'board.status me/Weaver#10',
      'card.move me/Weaver#30',
      'issue.comment me/Weaver#10',
      'project.add me/Weaver#20',
    ]);
    const reported = plan.reports.map((r) => `${r.tier}:${r.kind}:${r.subject}`).sort();
    expect(reported).toContain('proposed:task-without-issue:TASK-040');
    expect(reported).toContain('report:broken-issue-link:TASK-041');
    expect(plan.reports.every((r) => !r.automated)).toBe(true);
  });

  it('never plans to close an Issue, commit, or move a card to Verified that is still open', async () => {
    const plan = await planReconcile(input());
    for (const action of plan.actions) {
      expect(['project.add', 'board.status', 'issue.comment', 'card.move']).toContain(action.kind);
    }
    const moves = plan.actions.filter((a) => a.kind === 'card.move');
    expect(moves.map((a) => a.target)).toEqual(['me/Weaver#30']);
  });

  it('does not comment again when the note is already on the Issue, and reports it when comments cannot be read', async () => {
    const marked = await planReconcile(input({ fetchFn: rest([{ body: 'x <!-- weaver:pull-50 -->' }]).fetchFn }));
    expect(marked.actions.some((a) => a.kind === 'issue.comment')).toBe(false);

    const unreadable = await planReconcile(input({ fetchFn: rest([], 500).fetchFn }));
    expect(unreadable.actions.some((a) => a.kind === 'issue.comment')).toBe(false);
    expect(unreadable.reports.some((r) => r.kind === 'merged-pr-not-linked' && r.tier === 'proposed')).toBe(true);
  });

  it('only reports a board that is ahead of its label, and brings a board that is behind up to it', async () => {
    const ahead = await planReconcile(input({ artifacts: quiet, cards: [card(10, { labels: ['task', 'status:backlog'], boardStatus: 'In Progress' })], pulls: [pull({ closes: [10] })] }));
    expect(ahead.actions).toEqual([]);
    expect(ahead.reports.map((r) => r.kind)).toContain('board-status-differs');

    const behind = await planReconcile(input({ artifacts: quiet, cards: [card(10, { boardStatus: 'Todo' })], pulls: [pull({ closes: [10] })] }));
    expect(behind.actions.map((a) => a.kind)).toEqual(['board.status']);
  });

  it('is quiet when files, Issues, and the Project agree', async () => {
    const plan = await planReconcile(input({ artifacts: quiet, cards: [card(10, { boardStatus: 'In Progress' })], pulls: [pull({ closes: [10] })] }));
    expect(plan.actions).toEqual([]);
    expect(plan.reports).toEqual([]);
  });

  it('lists stale cards as a report for a person, with no action', async () => {
    const plan = await planReconcile(input({ artifacts: quiet, cards: [card(10, { boardStatus: 'In Progress', updatedAt: '2026-09-01T00:00:00Z' })], pulls: [pull({ closes: [10] })] }));
    expect(plan.reports.filter((r) => r.kind === 'stale.idle')).toHaveLength(1);
    expect(plan.actions).toEqual([]);
  });

  it('gives the same approval ids in English and Korean', async () => {
    const en = await planReconcile(input());
    const ko = await planReconcile(input({ locale: 'ko' }));
    expect(en.actions.map(actionId)).toEqual(ko.actions.map(actionId));
  });

  it('runs each planned action only through the confirmation path, with the steward attribution on comments', async () => {
    const github = rest();
    const plan = await planReconcile(input({ fetchFn: github.fetchFn }));
    const comment = plan.actions.find((a) => a.kind === 'issue.comment');
    if (!comment) throw new Error('no comment action');
    const log: unknown[] = [];
    const ctx: ExecuteContext = {
      locale: 'en',
      approved: new Set([actionId(comment)]),
      interactive: false,
      ask: async () => false,
      log: { append: async (entry) => void log.push(entry) },
      actor: 'steward',
      onBehalfOf: 'me',
      now: () => new Date('2026-11-01T00:00:00Z'),
      note: () => undefined,
    };
    const results = await executeActions(plan.actions, ctx);
    expect(results.filter((r) => r.outcome === 'done').map((r) => r.kind)).toEqual(['issue.comment']);
    const posted = github.calls.find((c) => c.method === 'POST');
    expect((posted?.body as { body: string }).body).toContain('Made by the Weaver steward on behalf of @me.');
    expect((posted?.body as { body: string }).body).toContain('<!-- weaver:pull-50 -->');
    expect(log).toHaveLength(1);
  });
});

describe('planReconcile: the task contract (DEC-016)', () => {
  const contractFor = (section: string) => {
    const task = parseProcess('process.yaml', `task:\n${section}`).process.task as TaskContract;
    return () => task;
  };
  const owner = '  fields:\n    owner:\n      label: "owner:{value}"\n    level:\n      project-field: Level\n';
  const withOwner = loadWorkspace([
    { path: 'req.md', text: files['req.md'] },
    { path: 'TASK-010.md', text: task('TASK-010', `issue: ${url(10)}\nowner: alpha\nlevel: high\n`) },
  ], { declaredTaskFields: () => ['owner', 'level'] }).artifacts;
  const base = { artifacts: withOwner, pulls: [] as MergedPull[] };

  it('only reports a field that differs from its label or Project field; nothing is changed', async () => {
    const cards = [card(10, { boardStatus: 'In Progress', labels: ['task', 'status:in-progress', 'owner:beta'], fields: { Level: 'low' } })];
    const plan = await planReconcile(input({ ...base, cards, contractFor: contractFor(owner) }));
    expect(plan.actions).toEqual([]);
    expect(plan.reports.map((r) => `${r.tier}:${r.kind}:${r.subject}`)).toEqual(['report:task-field-differs:TASK-010', 'report:task-field-differs:TASK-010']);
    expect(plan.reports[0].message).toContain('"owner"');
    expect(plan.reports[0].path).toBe('TASK-010.md');
  });

  it('is quiet when the card agrees with the file, and without a contract', async () => {
    const agree = [card(10, { boardStatus: 'In Progress', labels: ['task', 'status:in-progress', 'owner:alpha'], fields: { Level: 'high' } })];
    expect((await planReconcile(input({ ...base, cards: agree, contractFor: contractFor(owner) }))).reports).toEqual([]);
    const differs = [card(10, { boardStatus: 'In Progress', labels: ['task', 'status:in-progress', 'owner:beta'] })];
    expect((await planReconcile(input({ ...base, cards: differs }))).reports).toEqual([]);
  });

  it('does not ask for a file for a card when the process lets a card be an Issue only', async () => {
    const lone = [card(10, { boardStatus: 'In Progress', labels: ['task', 'status:in-progress', 'owner:alpha'], fields: { Level: 'high' } }), card(99, { boardStatus: 'In Progress' })];
    const asks = await planReconcile(input({ ...base, cards: lone, contractFor: contractFor(`  require-file: true\n${owner}`) }));
    expect(asks.reports.some((r) => r.kind === 'card-without-file')).toBe(true);
    const light = await planReconcile(input({ ...base, cards: lone, contractFor: contractFor(`  require-file: false\n${owner}`) }));
    expect(light.reports.some((r) => r.kind === 'card-without-file')).toBe(false);
    expect(light.actions.some((a) => a.kind.includes('draft') || a.kind.includes('pull'))).toBe(false);
  });
});
