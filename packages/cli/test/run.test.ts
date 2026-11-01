import { describe, expect, it } from 'vitest';
import type { Fetch } from '@palab/weaver-github';
import { addTaskToRequirement, actionId, EXIT, nextTaskNumber, parseArgs, parseColumn, parsePullRef, planProjectAdd, renderTaskFile, run, slugOf, taskListLine } from '../src';
import { FILES, setup, withGitHub } from './helpers';

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
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.no-setup');

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

  it('replaces the placeholder sentence when the first task starts the list, and keeps other text', () => {
    const line = taskListLine('TASK-001', 'One', 1, 'https://github.com/o/r/issues/1');
    const placeholder = '# R\n\n## Tasks\n\nTasks are not created yet. They are split once the open decisions are settled.\n\n## Evidence\n\ntext\n';
    expect(addTaskToRequirement(placeholder, line)).toBe('# R\n\n## Tasks\n\n' + line + '\n\n## Evidence\n\ntext\n');
    // A wrapped placeholder (two lines) goes as a whole; a section with other prose keeps it.
    const wrapped = '## Tasks\n\nTasks are not created yet.\nThey come later.\n';
    expect(addTaskToRequirement(wrapped, line)).toBe('## Tasks\n\n' + line + '\n');
    expect(addTaskToRequirement('## Tasks\n\nNone yet.\n', line)).toBe('## Tasks\n\n' + line + '\n\nNone yet.\n');
    // With CRLF the same holds.
    expect(addTaskToRequirement('## Tasks\r\n\r\nTasks are not created yet.\r\n', line)).toBe('## Tasks\r\n\r\n' + line + '\r\n');
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

describe('weaver card move', () => {
  const MOVE = ['card', 'move', 'me/Weaver#10', '--to', 'review'];

  it('shows what will change and changes nothing until that action is approved', async () => {
    const { deps, out, err } = setup();
    const gh = withGitHub(deps);
    expect(await run(MOVE, deps)).toBe(EXIT.unconfirmed);
    expect(err.join('')).toContain('Move me/Weaver#10 to Review:');
    expect(err.join('')).toContain('status:review');
    expect(JSON.parse(out.join('')).actions[0].kind).toBe('card.move');
    expect(gh.calls).toEqual([]);
  });

  it('moves the labels, the state, and the board Status once approved, and logs it', async () => {
    const first = setup();
    withGitHub(first.deps);
    await run(MOVE, first.deps);
    const id = JSON.parse(first.out.join('')).actions[0].id;

    const { deps, out, logged } = setup();
    const gh = withGitHub(deps);
    expect(await run([...MOVE, '--approve', id], deps)).toBe(EXIT.ok);
    expect(JSON.parse(out.join('')).status).toBe('done');
    expect(gh.calls).toEqual([
      'DELETE /repos/me/Weaver/issues/10/labels/status%3Ain-progress',
      'POST /repos/me/Weaver/issues/10/labels',
      'PATCH /repos/me/Weaver/issues/10',
      'POST graphql items',
      'POST graphql status',
    ]);
    expect(logged).toMatchObject([{ action: 'card.move', target: 'me/Weaver#10', outcome: 'done' }]);
  });

  it('gives the same approval id in every language', async () => {
    const ids: string[] = [];
    for (const lang of ['en', 'ko']) {
      const { deps, out } = setup();
      withGitHub(deps);
      await run([...MOVE, '--lang', lang], deps);
      ids.push(JSON.parse(out.join('')).actions[0].id);
    }
    expect(ids[0]).toBe(ids[1]);
  });

  it('does nothing when the card is already in that column', async () => {
    const { deps, out } = setup();
    withGitHub(deps);
    expect(await run(['card', 'move', 'me/Weaver#10', '--to', 'in-progress'], deps)).toBe(EXIT.ok);
    expect(JSON.parse(out.join('')).status).toBe('nothing');
  });

  it('refuses a move to Verified when no pull request is linked and the task has no exception', async () => {
    const { deps, out } = setup();
    const gh = withGitHub(deps, { linkedPull: false });
    expect(await run(['card', 'move', 'TASK-010', '--to', 'Verified'], deps)).toBe(EXIT.usage);
    const result = JSON.parse(out.join(''));
    expect(result.error.code).toBe('cli.move-refused');
    expect(gh.calls.some((c) => c.startsWith('PATCH'))).toBe(false);
  });

  it('allows a move to Verified with a linked pull request, closing the Issue', async () => {
    const { deps, out, err } = setup();
    const gh = withGitHub(deps, { linkedPull: true });
    expect(await run(['card', 'move', 'TASK-010', '--to', 'Verified'], deps)).toBe(EXIT.unconfirmed);
    expect(JSON.parse(out.join('')).actions[0].kind).toBe('card.move');
    expect(err.join('')).toContain('Close the Issue');
    expect(gh.calls.some((c) => c.startsWith('PATCH'))).toBe(false);
  });

  it('allows a move to Verified for a task with an evidence exception, without asking GitHub for evidence', async () => {
    const { deps, out } = setup();
    deps.files = async () => [FILES[0], { path: FILES[1].path, text: FILES[1].text.replace('assignee: claude-code\n', 'assignee: claude-code\nevidence_exception: before the rule\n') }];
    const gh = withGitHub(deps);
    expect(await run(['card', 'move', 'TASK-010', '--to', 'Verified'], deps)).toBe(EXIT.unconfirmed);
    expect(JSON.parse(out.join('')).actions).toHaveLength(1);
    expect(gh.calls.filter((c) => c.includes('/timeline'))).toEqual([]);
  });

  it('refuses an unknown column and asks for what is missing', async () => {
    let s = setup();
    expect(await run(['card', 'move', 'me/Weaver#10', '--to', 'Done'], s.deps)).toBe(EXIT.usage);
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.bad-column');
    s = setup();
    expect(await run(['card', 'move', 'me/Weaver#10'], s.deps)).toBe(EXIT.usage);
    expect(JSON.parse(s.out.join('')).error.code).toBe('cli.missing-argument');
    s = setup();
    expect(await run(['card', 'move', 'TASK-999', '--to', 'Review'], s.deps)).toBe(EXIT.notFound);
  });
});

describe('weaver evidence attach', () => {
  const ATTACH = ['evidence', 'attach', 'me/Weaver#10', '--pull', '7'];

  it('plans a comment for a merged pull request, and posts it in the steward\'s name once approved', async () => {
    const first = setup();
    withGitHub(first.deps);
    expect(await run(ATTACH, first.deps)).toBe(EXIT.unconfirmed);
    const id = JSON.parse(first.out.join('')).actions[0].id;

    const { deps, out, logged } = setup();
    const gh = withGitHub(deps);
    expect(await run(['evidence', 'attach', 'me/Weaver#10', '--pull', 'https://github.com/me/Weaver/pull/7', '--approve', id], deps)).toBe(EXIT.ok);
    expect(JSON.parse(out.join('')).status).toBe('done');
    expect(gh.calls).toContain('POST /repos/me/Weaver/issues/10/comments');
    const comment = gh.bodies.find((b) => typeof (b as { body?: string }).body === 'string') as { body: string };
    expect(comment.body).toContain('Made by the Weaver steward on behalf of @me.');
    expect(comment.body).toContain('https://github.com/me/Weaver/pull/7');
    expect(logged).toMatchObject([{ action: 'evidence.attach', target: 'me/Weaver#10', outcome: 'done' }]);
  });

  it('refuses a pull request that is not merged, one that is not found, and a bad reference', async () => {
    const code = async (pull: string, options = {}) => {
      const { deps, out } = setup();
      withGitHub(deps, options);
      const exit = await run(['evidence', 'attach', 'me/Weaver#10', '--pull', pull], deps);
      return [exit, JSON.parse(out.join('')).error.code];
    };
    expect(await code('7', { pullMerged: false })).toEqual([EXIT.usage, 'cli.pull-not-merged']);
    expect(await code('9')).toEqual([EXIT.usage, 'cli.pull-unreadable']);
    expect(await code('seven')).toEqual([EXIT.usage, 'cli.bad-pull']);
  });
});

describe('column and pull parsing', () => {
  it('reads a column however it is spelled', () => {
    expect(parseColumn('in-progress')).toBe('In progress');
    expect(parseColumn(' REVIEW ')).toBe('Review');
    expect(parseColumn('Done')).toBeUndefined();
    expect(parseColumn(undefined)).toBeUndefined();
  });

  it('reads a pull request number or address', () => {
    expect(parsePullRef('#7', 'me/Weaver')).toEqual({ repository: 'me/Weaver', number: 7 });
    expect(parsePullRef('https://github.com/me/Other/pull/3/', 'me/Weaver')).toEqual({ repository: 'me/Other', number: 3 });
    expect(parsePullRef('seven', 'me/Weaver')).toBeUndefined();
  });
});

describe('weaver reconcile', () => {
  it('only shows the plan and the report by default, even at a terminal, and exits 0', async () => {
    const { deps, out } = setup();
    deps.interactive = true;
    deps.ask = async () => {
      throw new Error('must not ask during a dry run');
    };
    expect(await run(['reconcile'], deps)).toBe(EXIT.ok);
    const result = JSON.parse(out.join(''));
    expect(result.schema).toBe(1);
    expect(result.report.some((r: { kind: string }) => r.kind === 'card-without-file')).toBe(true);
    expect(result.actions).toEqual([]);
  });

  it('prints a text report with --text', async () => {
    const { deps, out } = setup();
    expect(await run(['reconcile', '--text'], deps)).toBe(EXIT.ok);
    expect(out.join('')).toMatch(/^proposed\tcard-without-file\t#11\t/m);
  });
});

describe('where the configuration comes from', () => {
  const PERSONAL = 'project: {owner: me, number: 7}\n';
  const WORKSPACE = 'project: {owner: me, number: 1}\nrepositories:\n  - me/Weaver\n';

  /** Files by name, and the Project number each Project query asked for. */
  function withFiles(files: { workspace?: string; personal?: string }) {
    const s = setup();
    const asked: number[] = [];
    s.deps.readText = async (file) => (file.endsWith('fabric.yaml') ? files.workspace : file.endsWith('config.yaml') ? files.personal : undefined);
    const original = s.deps.fetch as Fetch;
    s.deps.fetch = async (url, init) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      if (body?.variables?.n !== undefined && body.query.includes('projectV2')) asked.push(body.variables.n);
      return original(url, init);
    };
    return { ...s, asked };
  }

  it('uses the personal configuration when the workspace has no fabric.yaml, with no repository list', async () => {
    const { deps, out, asked } = withFiles({ personal: PERSONAL });
    expect(await run(['list'], deps)).toBe(EXIT.ok);
    expect(asked).toEqual([7]);
    expect(JSON.parse(out.join('')).cards).toHaveLength(2);
  });

  it('lets the workspace fabric.yaml decide the Project when both exist', async () => {
    const { deps, asked } = withFiles({ workspace: WORKSPACE, personal: PERSONAL });
    expect(await run(['list'], deps)).toBe(EXIT.ok);
    expect(asked).toEqual([1]);
  });

  it('does not let a broken personal file get in the way of a workspace fabric.yaml', async () => {
    const { deps } = withFiles({ workspace: WORKSPACE, personal: 'project: [' });
    expect(await run(['list'], deps)).toBe(EXIT.ok);
  });

  it('says how to set up when there is no configuration at all', async () => {
    const { deps, out } = withFiles({});
    expect(await run(['list'], deps)).toBe(EXIT.failed);
    const error = JSON.parse(out.join('')).error;
    expect(error.code).toBe('cli.no-setup');
    expect(error.message).toContain('weaver init');
  });

  it('reports a configuration that cannot be read instead of falling back', async () => {
    const personal = withFiles({ personal: 'project: [' });
    expect(await run(['list'], personal.deps)).toBe(EXIT.failed);
    expect(JSON.parse(personal.out.join('')).error).toMatchObject({ code: 'cli.config-invalid' });
    expect(JSON.parse(personal.out.join('')).error.message).toContain('config.yaml');

    const workspace = withFiles({ workspace: 'repositories: [me/a]', personal: PERSONAL });
    expect(await run(['list'], workspace.deps)).toBe(EXIT.failed);
    expect(JSON.parse(workspace.out.join('')).error.message).toContain('fabric.yaml');
  });
});
