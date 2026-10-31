import { describe, expect, it } from 'vitest';
import type { Fetch } from '@palab/weaver-github';
import { addTaskToRequirement, actionId, Deps, EXIT, LogEntry, parseArgs, nextTaskNumber, planProjectAdd, renderTaskFile, run, slugOf, taskListLine } from '../src';

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
    text: '---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nrepository: me/Weaver\n---\n\n## Acceptance criteria\n\n- First thing\n- Second thing\n\n## Tasks\n\n- `TASK-010` Card ten — [GitHub Issue #10](https://github.com/me/Weaver/issues/10)\n',
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
  const shell: { command: string; args: string[]; cwd?: string }[] = [];
  const written: { file: string; text: string }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    if (url.includes('/repos/')) {
      writes.push(`REST ${url}`);
      return { ok: true, status: 201, json: async () => ({ number: 77, html_url: 'https://github.com/me/Weaver/issues/77' }) };
    }
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
    system: {
      run: async (command, args, options) => {
        shell.push({ command, args, cwd: options?.cwd });
        if (command === 'gh' && args[0] === 'pr' && args[1] === 'create') return 'https://github.com/me/Weaver/pull/200\n';
        if (command === 'gh' && args[0] === 'pr') return JSON.stringify([{ title: 'docs: add TASK-040 x', headRefName: 'docs/task-040-x' }]);
        if (command === 'gh') return 'main\n';
        if (args[0] === 'rev-parse') return '/work\n';
        return '';
      },
      tempDir: async () => '/tmp/work',
      readText: async (file) => (file.endsWith('REQ-001.md') ? FILES[0].text : undefined),
      writeFile: async (file, text) => void written.push({ file, text }),
    },
  };
  return { deps, out, err, writes, logged, shell, written };
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

describe('weaver task create', () => {
  const ARGS = ['task', 'create', '--title', 'Add the export button', '--requirement', 'REQ-001', '--criteria', 'AC-001,ac-002', '--assignee', 'claude-code'];

  async function approvedIds() {
    const first = setup();
    await run(ARGS, first.deps);
    return JSON.parse(first.out.join('')).actions.map((a: { id: string }) => a.id) as string[];
  }

  it('shows the three actions, with the next free number, and creates nothing until they are approved', async () => {
    const { deps, out, err, writes, shell } = setup();
    expect(await run(ARGS, deps)).toBe(EXIT.unconfirmed);
    const result = JSON.parse(out.join(''));
    expect(result.actions.map((a: { kind: string }) => a.kind)).toEqual(['issue.create', 'project.add', 'files.pull-request']);
    expect(err.join('')).toContain('[TASK-041] Add the export button');
    expect(err.join('')).toContain('tasks/TASK-041.md');
    expect(writes.filter((w) => w.startsWith('REST') || w.includes('addProjectV2ItemById'))).toEqual([]);
    expect(shell.filter((s) => s.args[0] === 'push' || s.args[0] === 'worktree')).toEqual([]);
  });

  it('creates the Issue, adds the card, and opens a pull request from a separate worktree once all three are approved', async () => {
    const ids = (await approvedIds()).join(',');
    const { deps, out, writes, shell, written, logged } = setup();
    expect(await run([...ARGS, '--approve', ids], deps)).toBe(EXIT.ok);
    expect(JSON.parse(out.join('')).status).toBe('done');
    expect(writes).toContain('REST https://api.github.com/repos/me/Weaver/issues');
    expect(writes.some((w) => w.includes('addProjectV2ItemById'))).toBe(true);
    expect(logged.map((l) => l.action)).toEqual(['issue.create', 'project.add', 'files.pull-request']);

    const git = shell.filter((s) => s.command === 'git').map((s) => s.args.slice(0, 2).join(' '));
    expect(git).toEqual(['rev-parse --show-toplevel', 'fetch origin', 'worktree add', 'add -A', 'commit -m', 'push -u', 'worktree remove']);
    expect(shell.find((s) => s.args[0] === 'worktree' && s.args[1] === 'add')?.args).toContain('origin/main');
    expect(shell.find((s) => s.args[0] === 'pr' && s.args[1] === 'create')?.args).toContain('docs/task-041-add-the-export-button');
    expect(shell.find((s) => s.args[0] === 'commit')?.args[2]).toContain('Made by the Weaver steward on behalf of @me.');

    const task = written.find((w) => w.file.endsWith('TASK-041.md'));
    expect(task?.file.replace(/\\/g, '/')).toBe('/tmp/work/tasks/TASK-041.md');
    expect(task?.text).toContain('issue: https://github.com/me/Weaver/issues/77');
    expect(task?.text).toContain('criteria: [AC-001, AC-002]');
    expect(task?.text).toContain('assignee: claude-code');
    const requirement = written.find((w) => w.file.endsWith('REQ-001.md'));
    expect(requirement?.text).toContain('- `TASK-041` Add the export button — [GitHub Issue #77](https://github.com/me/Weaver/issues/77)');
  });

  it('says what was already created when a later step fails, and cleans up the worktree', async () => {
    const ids = (await approvedIds()).join(',');
    const { deps, out, shell } = setup();
    const original = deps.system.run;
    deps.system.run = async (command, args, options) => {
      if (command === 'git' && args[0] === 'push') throw new Error('push rejected');
      return original(command, args, options);
    };
    expect(await run([...ARGS, '--approve', ids], deps)).toBe(EXIT.failed);
    const result = JSON.parse(out.join(''));
    expect(result.actions.map((a: { outcome: string }) => a.outcome)).toEqual(['done', 'done', 'failed']);
    expect(result.actions[2].message).toBe('push rejected');
    expect(shell.some((s) => s.args[0] === 'worktree' && s.args[1] === 'remove')).toBe(true);
  });

  it('skips the card and the pull request when the Issue was not created', async () => {
    const ids = (await approvedIds()).join(',');
    const { deps, out } = setup();
    const original = deps.fetch as Fetch;
    deps.fetch = async (url, init) => (url.includes('/repos/') ? { ok: false, status: 422, json: async () => ({ message: 'Validation Failed' }) } : original(url, init));
    expect(await run([...ARGS, '--approve', ids], deps)).toBe(EXIT.failed);
    expect(JSON.parse(out.join('')).actions.map((a: { outcome: string }) => a.outcome)).toEqual(['failed', 'skipped', 'skipped']);
  });

  it('refuses a missing requirement, a colon in the title, an unknown criterion, and a missing option', async () => {
    const code = async (args: string[]) => {
      const { deps, out } = setup();
      const exit = await run(args, deps);
      return [exit, JSON.parse(out.join('')).error.code];
    };
    expect(await code(['task', 'create', '--title', 'x', '--requirement', 'REQ-999'])).toEqual([EXIT.notFound, 'cli.requirement-not-found']);
    expect(await code(['task', 'create', '--title', 'a: b', '--requirement', 'REQ-001'])).toEqual([EXIT.usage, 'cli.bad-title']);
    expect(await code(['task', 'create', '--title', 'x', '--requirement', 'REQ-001', '--criteria', 'AC-009'])).toEqual([EXIT.usage, 'cli.unknown-criterion']);
    expect(await code(['task', 'create', '--title', 'x', '--requirement', 'REQ-001', '--repository', 'me/Other'])).toEqual([EXIT.usage, 'cli.repository-unregistered']);
    expect(await code(['task', 'create', '--title', 'x'])).toEqual([EXIT.usage, 'cli.missing-argument']);
  });
});

describe('task file helpers', () => {
  it('numbers after the largest task anywhere, ignoring other text', () => {
    expect(nextTaskNumber(['TASK-009', '[TASK-012] x', 'docs/task-040-y', 'no task'])).toBe(41);
    expect(nextTaskNumber([])).toBe(1);
  });

  it('makes a short branch slug', () => {
    expect(slugOf('Add the export button!')).toBe('add-the-export-button');
    expect(slugOf('???')).toBe('task');
    expect(slugOf('x'.repeat(60)).length).toBeLessThanOrEqual(40);
  });

  it('renders the task file header, leaving out an assignee that was not given', () => {
    const text = renderTaskFile({ id: 'TASK-041', title: 'Export', requirement: 'REQ-001', issueUrl: 'https://github.com/me/Weaver/issues/77', issueNumber: 77, repository: 'me/Weaver', criteria: ['AC-001'], assigneeType: 'agent' });
    expect(text.startsWith('---\nid: TASK-041\ntype: task\ntitle: Export\n')).toBe(true);
    expect(text).not.toContain('assignee:');
  });

  it('adds a task line at the end of the list under Tasks, or starts the list', () => {
    const line = taskListLine('TASK-002', 'Two', 2, 'https://github.com/o/r/issues/2');
    const withList = '# R\n\n## Tasks\n\n- `TASK-001` One\n\n## Evidence\n\ntext\n';
    expect(addTaskToRequirement(withList, line)).toBe('# R\n\n## Tasks\n\n- `TASK-001` One\n' + line + '\n\n## Evidence\n\ntext\n');
    expect(addTaskToRequirement('## Tasks\n\nNone yet.\n', line)).toBe('## Tasks\n\n' + line + '\n\nNone yet.\n');
    expect(addTaskToRequirement('# no tasks section\n', line)).toBeUndefined();
    expect(addTaskToRequirement('## Tasks\r\n\r\n- a\r\n', line)).toBe('## Tasks\r\n\r\n- a\r\n' + line + '\r\n');
  });
});
