import { describe, expect, it } from 'vitest';
import type { Fetch } from '@palab/weaver-github';
import { EXIT, run } from '../src';
import { setup, withGitHub } from './helpers';

/** The process file of `me/Weaver`; every other file lookup keeps the helper's answer (none). */
function withProcessFile(deps: ReturnType<typeof setup>['deps'], answer: { status: number; text?: string }) {
  const original = deps.fetch as Fetch;
  deps.fetch = (async (url: string, init: never) =>
    url.includes('/contents/.weaver/process.yaml')
      ? { ok: answer.status === 200, status: answer.status, headers: { get: () => null }, text: async () => answer.text ?? '' }
      : original(url, init)) as unknown as Fetch;
}

const BOARD = 'columns:\n  source: board-status\n';

describe('the columns of a repository come from its process', () => {
  it('lists cards in the column the board Status gives, when the process says the board is the source', async () => {
    const { deps, out } = setup();
    withProcessFile(deps, { status: 200, text: BOARD });
    expect(await run(['list'], deps)).toBe(EXIT.ok);
    const cards = JSON.parse(out.join('')).cards;
    // The helper's cards are "In Progress" on the board and carry a status:in-progress label.
    expect(cards.map((c: { column: string }) => c.column)).toEqual(['In progress', 'In progress']);
    expect(cards[0]).toMatchObject({ boardStatus: 'In Progress', gaps: [] });
  });

  it('does not use the status labels when the board is the source', async () => {
    const { deps, out } = setup();
    withProcessFile(deps, { status: 200, text: 'columns:\n  source: board-status\n  board:\n    Next: In progress\n' });
    await run(['list'], deps);
    // "In Progress" is no longer a known Status of this repository.
    expect(JSON.parse(out.join('')).cards[0]).toMatchObject({ column: 'Backlog', gaps: ['gap.unmapped-board-status'] });
  });

  it('reads the labels the repository named', async () => {
    const { deps, out } = setup();
    withProcessFile(deps, { status: 200, text: 'columns:\n  labels:\n    In progress: doing\n' });
    await run(['list'], deps);
    expect(JSON.parse(out.join('')).cards[0]).toMatchObject({ column: 'Backlog', gaps: ['gap.no-status-label'] });
  });

  it('keeps today\'s columns for a repository without a file, and for one whose file cannot be read, and says so', async () => {
    const missing = setup();
    withProcessFile(missing.deps, { status: 404 });
    await run(['list'], missing.deps);
    expect(JSON.parse(missing.out.join('')).cards[0]).toMatchObject({ column: 'In progress', gaps: [] });
    expect(missing.err).toEqual([]);

    const failed = setup();
    withProcessFile(failed.deps, { status: 500 });
    await run(['list'], failed.deps);
    expect(JSON.parse(failed.out.join('')).cards[0]).toMatchObject({ column: 'In progress', gaps: [] });
    expect(failed.err.join('')).toContain('me/Weaver: its process file could not be read, so the defaults are used');
  });

  it('refuses a move to a column the board cannot show, before any plan is made', async () => {
    const { deps, out } = setup();
    withGitHub(deps);
    withProcessFile(deps, { status: 200, text: BOARD });
    expect(await run(['card', 'move', 'me/Weaver#10', '--to', 'review'], deps)).toBe(EXIT.usage);
    expect(JSON.parse(out.join('')).error.code).toBe('cli.move-unavailable');
  });

  it('plans a move that only sets the board Status when the board is the source', async () => {
    const { deps, out, err } = setup();
    const gh = withGitHub(deps, { linkedPull: true });
    withProcessFile(deps, { status: 200, text: BOARD });
    expect(await run(['card', 'move', 'me/Weaver#10', '--to', 'verified'], deps)).toBe(EXIT.unconfirmed);
    expect(JSON.parse(out.join('')).actions[0].kind).toBe('card.move');
    expect(err.join('')).toContain('Close the Issue');
    expect(err.join('')).toContain('Done');
    expect(err.join('')).not.toContain('status:verified');
    expect(gh.calls.some((c) => c.startsWith('PATCH') || c.includes('/labels'))).toBe(false);
  });
});
