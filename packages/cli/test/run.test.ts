import { describe, expect, it } from 'vitest';
import type { Fetch } from '@palab/weaver-github';
import { actionId, Deps, EXIT, LogEntry, parseArgs, planProjectAdd, run } from '../src';

const REGISTRY = 'project: {owner: me, number: 1}\nrepositories:\n  - me/Weaver\n';

const issue = (number: number, extra: Record<string, unknown> = {}) => ({
  fieldValueByName: { name: 'In Progress' },
  content: {
    __typename: 'Issue',
    number,
    title: `[TASK-0${number}] Card ${number}`,
    url: `https://github.com/me/Weaver/issues/${number}`,
    state: 'OPEN',
    updatedAt: '2026-10-01T00:00:00Z',
    closedByPullRequestsReferences: { totalCount: 0 },
    timelineItems: { totalCount: 0 },
    repository: { nameWithOwner: 'me/Weaver' },
    labels: { nodes: [{ name: 'status:in-progress' }] },
    assignees: { nodes: [] },
    ...extra,
  },
});

const FILES = [
  {
    path: 'requirements/REQ-001.md',
    text: '---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\n---\n\n## Tasks\n\n- `TASK-010` Card ten — [GitHub Issue #10](https://github.com/me/Weaver/issues/10)\n',
  },
  {
    path: 'tasks/TASK-010.md',
    text: '---\nid: TASK-010\ntype: task\ntitle: Card ten\nrequirement: REQ-001\nissue: https://github.com/me/Weaver/issues/10\nassignee_type: agent\nassignee: claude-code\n---\n',
  },
];

function setup(options: { token?: string | undefined; registry?: string; pullsFail?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const writes: string[] = [];
  const logged: LogEntry[] = [];
  const fetchImpl: Fetch = async (_url, init) => {
    const query = JSON.parse(init.body).query as string;
    writes.push(query);
    if (query.includes('resource(url')) {
      return { ok: true, status: 200, json: async () => ({ data: { repositoryOwner: { projectV2: { id: 'PROJECT' } }, resource: { id: 'ISSUE' } } }) };
    }
    if (query.includes('addProjectV2ItemById')) return { ok: true, status: 200, json: async () => ({ data: { addProjectV2ItemById: { item: { id: 'ITEM' } } } }) };
    if (query.includes('projectV2')) {
      const body = { data: { repositoryOwner: { projectV2: { title: 'Board', items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [issue(10), issue(11)] } } } } };
      return { ok: true, status: 200, json: async () => body };
    }
    if (options.pullsFail) return { ok: false, status: 500, json: async () => ({}) };
    const nodes = [{ number: 7, title: 'feat: ten (TASK-010)', url: 'https://github.com/me/Weaver/pull/7', headRefName: 'feat/task-010', closingIssuesReferences: { nodes: [{ number: 10 }] } }];
    return { ok: true, status: 200, json: async () => ({ data: { repository: { pullRequests: { nodes } } } }) };
  };
  const deps: Deps = {
    cwd: '/work',
    env: {},
    out: (text) => void out.push(text),
    err: (text) => void err.push(text),
    token: async () => ('token' in options ? options.token : 't'),
    fetch: fetchImpl,
    files: async () => FILES,
    readText: async () => ('registry' in options ? options.registry : REGISTRY),
    now: () => new Date('2026-11-01T00:00:00Z'),
    login: async () => 'me',
    interactive: false,
    ask: async () => false,
    log: { append: async (entry) => void logged.push(entry) },
  };
  return { deps, out, err, writes, logged };
}

describe('parseArgs', () => {
  it('splits the command, options, and flags', () => {
    const args = parseArgs(['list', '--root', 'x', '--text']);
    expect('unknown' in args).toBe(false);
    if ('unknown' in args) return;
    expect(args.command).toBe('list');
    expect(args.options.root).toBe('x');
    expect(args.flags.has('text')).toBe(true);
  });

  it('reports an option it does not know', () => {
    expect(parseArgs(['list', '--bogus'])).toEqual({ unknown: '--bogus' });
  });
});

describe('weaver list', () => {
  it('prints every card as JSON with its task, requirement, and stale marks', async () => {
    const { deps, out } = setup();
    expect(await run(['list'], deps)).toBe(EXIT.ok);
    const result = JSON.parse(out.join(''));
    expect(result.schema).toBe(1);
    expect(result.project).toEqual({ owner: 'me', number: 1, title: 'Board' });
    expect(result.cards).toHaveLength(2);
    const ten = result.cards.find((c: { number: number }) => c.number === 10);
    expect(ten).toMatchObject({ repository: 'me/Weaver', column: 'In progress', task: { id: 'TASK-010', path: 'tasks/TASK-010.md' }, requirement: { id: 'REQ-001' } });
    expect(ten.stale).toEqual(['idle']);
  });

  it('filters by column and repository, and prints text on request', async () => {
    const { deps, out } = setup();
    expect(await run(['list', '--column', 'review'], deps)).toBe(EXIT.ok);
    expect(JSON.parse(out.join('')).cards).toHaveLength(0);
    out.length = 0;
    expect(await run(['list', '--text', '--repository', 'ME/weaver'], deps)).toBe(EXIT.ok);
    expect(out.join('').split('\n').filter(Boolean)).toHaveLength(2);
    expect(out.join('')).toContain('me/Weaver#10\tIn progress\t[TASK-010] Card 10');
  });
});

describe('weaver show', () => {
  it('shows a card by task id with its task, requirement, and pull requests', async () => {
    const { deps, out } = setup();
    expect(await run(['show', 'TASK-010'], deps)).toBe(EXIT.ok);
    const result = JSON.parse(out.join(''));
    expect(result.card.number).toBe(10);
    expect(result.task).toMatchObject({ id: 'TASK-010', assignee: 'claude-code', assigneeType: 'agent' });
    expect(result.requirement).toMatchObject({ id: 'REQ-001', title: 'First' });
    expect(result.pulls).toEqual([{ number: 7, title: 'feat: ten (TASK-010)', url: 'https://github.com/me/Weaver/pull/7', closes: true }]);
  });

  it('accepts owner/name#number and an Issue address', async () => {
    for (const ref of ['me/weaver#11', 'https://github.com/me/Weaver/issues/11/']) {
      const { deps, out } = setup();
      expect(await run(['show', ref], deps)).toBe(EXIT.ok);
      expect(JSON.parse(out.join('')).card.number).toBe(11);
    }
  });

  it('still answers when the pull requests cannot be read, and says so', async () => {
    const { deps, out } = setup({ pullsFail: true });
    expect(await run(['show', 'me/Weaver#10'], deps)).toBe(EXIT.ok);
    const result = JSON.parse(out.join(''));
    expect(result.pulls).toBeNull();
    expect(result.warnings).toHaveLength(1);
  });

  it('exits with not-found for an unknown card', async () => {
    const { deps, out } = setup();
    expect(await run(['show', 'TASK-999'], deps)).toBe(EXIT.notFound);
    expect(JSON.parse(out.join('')).error.code).toBe('cli.not-found');
  });
});

describe('failures', () => {
  it('reports a missing registry, a missing token, and a bad command as JSON, or as text with --text', async () => {
    let s = setup({ registry: '' });
    expect(await run(['list'], s.deps)).toBe(EXIT.failed);
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.no-registry');

    s = setup({ token: undefined });
    expect(await run(['list'], s.deps)).toBe(EXIT.failed);
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.no-token');

    s = setup();
    expect(await run(['frobnicate'], s.deps)).toBe(EXIT.usage);
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.unknown-command');

    s = setup({ token: undefined });
    expect(await run(['list', '--text'], s.deps)).toBe(EXIT.failed);
    expect(s.out).toEqual([]);
    expect(s.err.join('')).toContain('gh auth login');
  });

  it('asks for a card, prints help, and answers in Korean on request', async () => {
    let s = setup();
    expect(await run(['show'], s.deps)).toBe(EXIT.usage);
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.missing-argument');

    s = setup();
    expect(await run(['--help'], s.deps)).toBe(EXIT.ok);
    expect(s.out.join('')).toContain('weaver <command>');

    s = setup({ token: undefined });
    expect(await run(['list', '--lang', 'ko'], s.deps)).toBe(EXIT.failed);
    expect(JSON.parse(s.out.join('')).error.message).toContain('토큰');
  });

  it('reads the language from WEAVER_LANG', async () => {
    const s = setup({ token: undefined });
    s.deps.env.WEAVER_LANG = 'ko';
    await run(['list'], s.deps);
    expect(JSON.parse(s.out.join('')).error.message).toContain('토큰');
  });
});

describe('weaver project add', () => {
  const ISSUE = 'https://github.com/me/Weaver/issues/12';
  const mutations = (writes: string[]) => writes.filter((q) => q.includes('addProjectV2ItemById'));

  it('shows the plan and adds nothing until the user approved that action', async () => {
    const { deps, out, err, writes } = setup();
    expect(await run(['project', 'add', ISSUE], deps)).toBe(EXIT.unconfirmed);
    const result = JSON.parse(out.join(''));
    expect(result).toMatchObject({ status: 'unconfirmed', actions: [{ kind: 'project.add', target: 'me/Weaver#12', outcome: 'unconfirmed' }] });
    expect(err.join('')).toContain('Add Issue me/Weaver#12 to the Project me/1.');
    expect(mutations(writes)).toEqual([]);
  });

  it('adds the Issue after the id of that action was approved, and records it in the log', async () => {
    const first = setup();
    await run(['project', 'add', ISSUE], first.deps);
    const id = JSON.parse(first.out.join('')).actions[0].id;

    const { deps, out, writes, logged } = setup();
    expect(await run(['project', 'add', 'me/Weaver#12', '--approve', id], deps)).toBe(EXIT.ok);
    expect(JSON.parse(out.join('')).status).toBe('done');
    expect(mutations(writes)).toHaveLength(1);
    expect(logged).toMatchObject([{ actor: 'steward', onBehalfOf: 'me', action: 'project.add', target: 'me/Weaver#12', outcome: 'done' }]);
  });

  it('does not take an approval of another Issue', async () => {
    const { deps, writes } = setup();
    expect(await run(['project', 'add', ISSUE, '--approve', 'deadbeef0000'], deps)).toBe(EXIT.unconfirmed);
    expect(mutations(writes)).toEqual([]);
  });

  it('asks at a terminal and honors a no', async () => {
    const { deps, writes } = setup();
    deps.interactive = true;
    deps.ask = async () => false;
    expect(await run(['project', 'add', ISSUE], deps)).toBe(EXIT.declined);
    expect(mutations(writes)).toEqual([]);
  });

  it('leaves out an Issue already on the Project, of another repository, or not an Issue', async () => {
    const { deps, out } = setup();
    expect(await run(['project', 'add', 'me/Weaver#10', 'me/Other#1', 'not-an-issue'], deps)).toBe(EXIT.ok);
    const result = JSON.parse(out.join(''));
    expect(result.status).toBe('nothing');
    expect(result.skipped).toEqual([
      { ref: 'me/Weaver#10', reason: 'already-on-project' },
      { ref: 'me/Other#1', reason: 'not-registered' },
      { ref: 'not-an-issue', reason: 'invalid' },
    ]);
  });

  it('asks for an Issue', async () => {
    const { deps, out } = setup();
    expect(await run(['project', 'add'], deps)).toBe(EXIT.usage);
    expect(JSON.parse(out.join('')).error.code).toBe('cli.missing-argument');
  });
});

describe('planProjectAdd', () => {
  it('plans each Issue once, whichever way it is written', () => {
    const plan = planProjectAdd(['me/Weaver#12', 'https://github.com/me/Weaver/issues/12/', 'me/weaver#12'], {
      token: 't',
      project: { owner: 'me', number: 1 },
      repositories: ['me/Weaver'],
      onProject: [],
    });
    expect(plan.actions).toHaveLength(1);
    expect(actionId(plan.actions[0])).toMatch(/^[0-9a-f]{12}$/);
  });
});
