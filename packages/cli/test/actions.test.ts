import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import {
  actionId,
  attribution,
  EXIT,
  executeActions,
  ExecuteContext,
  exitCodeOf,
  finishActions,
  fileActionLog,
  LogEntry,
  parseApproved,
  PlannedAction,
} from '../src';

/** An action that records whether it ran and can be made to fail. */
function action(target: string, options: { fail?: boolean; dependsOn?: PlannedAction[] } = {}) {
  const ran: string[] = [];
  const planned: PlannedAction = {
    kind: 'test.write',
    target,
    summary: { code: 'cli.not-found', args: { ref: `change ${target}` } },
    reason: { code: 'cli.no-token' },
    ...(options.dependsOn ? { dependsOn: options.dependsOn } : {}),
    run: async () => {
      if (options.fail) throw new Error('boom');
      ran.push(target);
    },
  };
  return { planned, ran };
}

function context(options: { approved?: string[]; interactive?: boolean; answers?: boolean[] } = {}) {
  const entries: LogEntry[] = [];
  const notes: string[] = [];
  const questions: string[] = [];
  const answers = [...(options.answers ?? [])];
  const ctx: ExecuteContext = {
    locale: 'en',
    approved: new Set(options.approved ?? []),
    interactive: options.interactive ?? false,
    ask: async (question) => {
      questions.push(question);
      return answers.shift() ?? false;
    },
    log: { append: async (entry) => void entries.push(entry) },
    actor: 'steward',
    onBehalfOf: 'me',
    now: () => new Date('2026-11-01T09:00:00Z'),
    note: (text) => void notes.push(text),
  };
  return { ctx, entries, notes, questions };
}

describe('executeActions', () => {
  it('shows the plan and changes nothing when nobody confirmed it', async () => {
    const a = action('me/Weaver#1');
    const { ctx, entries, notes } = context();
    const results = await executeActions([a.planned], ctx);
    expect(a.ran).toEqual([]);
    expect(results.map((r) => r.outcome)).toEqual(['unconfirmed']);
    expect(entries).toEqual([]);
    expect(notes.join('')).toContain(`id ${actionId(a.planned)}`);
    expect(notes.join('')).toContain('me/Weaver#1');
    expect(exitCodeOf(results)).toBe(EXIT.unconfirmed);
  });

  it('runs only the actions whose id was approved, and an approval does not carry over to another action', async () => {
    const a = action('me/Weaver#1');
    const b = action('me/Weaver#2');
    const { ctx } = context({ approved: [actionId(a.planned)] });
    const results = await executeActions([a.planned, b.planned], ctx);
    expect(a.ran).toEqual(['me/Weaver#1']);
    expect(b.ran).toEqual([]);
    expect(results.map((r) => r.outcome)).toEqual(['done', 'unconfirmed']);
    expect(actionId(a.planned)).not.toBe(actionId(b.planned));
  });

  it('asks a person one action at a time and honors a refusal', async () => {
    const a = action('me/Weaver#1');
    const b = action('me/Weaver#2');
    const { ctx, questions } = context({ interactive: true, answers: [true, false] });
    const results = await executeActions([a.planned, b.planned], ctx);
    expect(questions).toHaveLength(2);
    expect(results.map((r) => r.outcome)).toEqual(['done', 'declined']);
    expect(b.ran).toEqual([]);
    expect(exitCodeOf(results)).toBe(EXIT.declined);
  });

  it('does not ask about an action that was approved ahead of time', async () => {
    const a = action('me/Weaver#1');
    const { ctx, questions } = context({ interactive: true, approved: [actionId(a.planned)] });
    await executeActions([a.planned], ctx);
    expect(questions).toEqual([]);
    expect(a.ran).toEqual(['me/Weaver#1']);
  });

  it('logs who did what and why for every executed action, and nothing for the rest', async () => {
    const a = action('me/Weaver#1');
    const b = action('me/Weaver#2');
    const { ctx, entries } = context({ approved: [actionId(a.planned)] });
    await executeActions([a.planned, b.planned], ctx);
    expect(entries).toEqual([
      {
        time: '2026-11-01T09:00:00.000Z',
        actor: 'steward',
        onBehalfOf: 'me',
        action: 'test.write',
        target: 'me/Weaver#1',
        reason: 'No GitHub token. Run: gh auth login -s repo,project',
        outcome: 'done',
      },
    ]);
  });

  it('stops at the first failure, logs it, and skips what is left', async () => {
    const a = action('one', { fail: true });
    const b = action('two');
    const { ctx, entries } = context({ approved: [actionId(a.planned), actionId(b.planned)] });
    const results = await executeActions([a.planned, b.planned], ctx);
    expect(results.map((r) => r.outcome)).toEqual(['failed', 'skipped']);
    expect(results[0].message).toBe('boom');
    expect(b.ran).toEqual([]);
    expect(entries).toMatchObject([{ target: 'one', outcome: 'failed', message: 'boom' }]);
    expect(exitCodeOf(results)).toBe(EXIT.failed);
  });

  it('skips an action whose prerequisite did not run', async () => {
    const first = action('first');
    const second = action('second', { dependsOn: [first.planned] });
    const { ctx } = context({ approved: [actionId(second.planned)] });
    const results = await executeActions([first.planned, second.planned], ctx);
    expect(results.map((r) => r.outcome)).toEqual(['unconfirmed', 'skipped']);
    expect(second.ran).toEqual([]);
  });

  it('succeeds quietly when there is nothing to do', async () => {
    const { ctx, entries } = context();
    const results = await executeActions([], ctx);
    expect(results).toEqual([]);
    expect(entries).toEqual([]);
    expect(exitCodeOf(results)).toBe(EXIT.ok);
  });
});

describe('finishActions', () => {
  const results = [
    { id: 'abc', kind: 'test.write', target: 't', summary: 's', reason: 'r', outcome: 'unconfirmed' as const },
  ];

  it('prints JSON with a status for an agent, and the approval hint as text', () => {
    const out: string[] = [];
    const err: string[] = [];
    expect(finishActions(results, { out: (x) => void out.push(x), err: (x) => void err.push(x) }, 'en', false)).toBe(EXIT.unconfirmed);
    expect(JSON.parse(out.join(''))).toMatchObject({ schema: 1, status: 'unconfirmed', actions: [{ id: 'abc' }] });

    out.length = 0;
    finishActions(results, { out: (x) => void out.push(x), err: (x) => void err.push(x) }, 'en', true);
    expect(out.join('')).toContain('not confirmed\ttest.write\tt');
    expect(err.join('')).toContain('--approve abc');
  });

  it('reports nothing to do as status "nothing"', () => {
    const out: string[] = [];
    finishActions([], { out: (x) => void out.push(x), err: () => undefined }, 'ko', false);
    expect(JSON.parse(out.join('')).status).toBe('nothing');
  });
});

describe('the local log', () => {
  it('appends one JSON line per entry outside the repository', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-log-'));
    const file = path.join(directory, 'nested', 'actions.jsonl');
    const log = fileActionLog(file);
    const entry: LogEntry = { time: 't', actor: 'steward', action: 'x', target: 'y', reason: 'z', outcome: 'done' };
    await log.append(entry);
    await log.append({ ...entry, target: 'y2' });
    const lines = (await fs.readFile(file, 'utf8')).trim().split('\n');
    expect(lines.map((l) => JSON.parse(l).target)).toEqual(['y', 'y2']);
    await fs.rm(directory, { recursive: true });
  });
});

describe('attribution and approval parsing', () => {
  it('names the user the steward acts for, in either language', () => {
    expect(attribution('en', 'me')).toBe('Made by the Weaver steward on behalf of @me.');
    expect(attribution('ko', 'me')).toContain('@me');
    expect(attribution('en', undefined)).toBe('Made by the Weaver steward.');
  });

  it('reads a comma separated list of ids', () => {
    expect([...parseApproved('a, b,,c')]).toEqual(['a', 'b', 'c']);
    expect([...parseApproved(undefined)]).toEqual([]);
  });
});
