import { describe, expect, it } from 'vitest';
import { boardGaps, defaultProcess, describeMove, findMismatches, parseProcess, placeIssue, planMove, type ColumnRules, type MismatchCard } from '../src';

const rulesOf = (yaml: string): ColumnRules => parseProcess('.weaver/process.yaml', yaml).process.columns;
const board = rulesOf('columns:\n  source: board-status\n');
const renamed = rulesOf('columns:\n  labels:\n    Review: needs-review\n    Ready: up-next\n');

describe('placeIssue with the rules of a repository', () => {
  it('gives the same answer with the default rules as without any', () => {
    const rules = defaultProcess().columns;
    for (const labels of [[], ['status:ready'], ['status:review', 'status:ready'], ['status:verified']]) {
      for (const state of ['open', 'closed'] as const) {
        expect(placeIssue({ state, labels }, rules)).toEqual(placeIssue({ state, labels }));
      }
    }
  });

  it('reads the labels the repository named, and ignores the default ones', () => {
    expect(placeIssue({ state: 'open', labels: ['needs-review'] }, renamed)).toEqual({ column: 'Review', gaps: [] });
    expect(placeIssue({ state: 'open', labels: ['up-next'] }, renamed).column).toBe('Ready');
    expect(placeIssue({ state: 'open', labels: ['status:review'] }, renamed)).toEqual({ column: 'Backlog', gaps: [{ code: 'gap.no-status-label' }] });
  });

  it('takes the column from the board Status when the process says so', () => {
    expect(placeIssue({ state: 'open', labels: [], boardStatus: 'In Progress' }, board)).toEqual({ column: 'In progress', gaps: [] });
    expect(placeIssue({ state: 'open', labels: [], boardStatus: 'Todo' }, board).column).toBe('Backlog');
    expect(placeIssue({ state: 'closed', labels: [], boardStatus: 'Done' }, board)).toEqual({ column: 'Verified', gaps: [] });
  });

  it('does not look at labels when the board is the source', () => {
    expect(placeIssue({ state: 'open', labels: ['status:review'], boardStatus: 'Todo' }, board).column).toBe('Backlog');
  });

  it('says so when the card has no board Status or one the process does not know', () => {
    expect(placeIssue({ state: 'open', labels: [] }, board)).toEqual({ column: 'Backlog', gaps: [{ code: 'gap.no-board-status' }] });
    expect(placeIssue({ state: 'open', labels: [], boardStatus: 'Waiting' }, board)).toEqual({ column: 'Backlog', gaps: [{ code: 'gap.unmapped-board-status', args: { status: 'Waiting' } }] });
  });

  it('still catches a closed card that is not Done and an open card that is', () => {
    expect(placeIssue({ state: 'closed', labels: [], boardStatus: 'In Progress' }, board)).toEqual({ column: 'Review', gaps: [{ code: 'gap.closed-without-verified' }] });
    expect(placeIssue({ state: 'open', labels: [], boardStatus: 'Done' }, board)).toEqual({ column: 'Verified', gaps: [{ code: 'gap.open-but-verified' }] });
  });
});

describe('planMove with the rules of a repository', () => {
  it('adds and removes the labels the repository named', () => {
    const plan = planMove({ state: 'open', labels: ['up-next', 'status:ready', 'task'] }, 'Review', renamed);
    expect(plan.addLabel).toBe('needs-review');
    // "status:ready" is no status label of this repository, so it is left alone.
    expect(plan.removeLabels).toEqual(['up-next']);
    expect(plan.projectStatus).toBe('In Progress');
  });

  it('only sets the board Status when the board is the source, and has nothing to label', () => {
    const plan = planMove({ state: 'open', labels: ['status:ready'], boardStatus: 'Todo' }, 'In progress', board);
    expect(plan).toMatchObject({ column: 'In progress', removeLabels: [], projectStatus: 'In Progress', state: 'open', noop: false });
    expect(plan.addLabel).toBeUndefined();
    expect(describeMove(plan, { state: 'open', labels: [] }).map((line) => line.code)).toEqual(['move.set-board-status']);
  });

  it('is nothing to do when the board and the state already match', () => {
    expect(planMove({ state: 'closed', labels: [], boardStatus: 'Done' }, 'Verified', board).noop).toBe(true);
    expect(planMove({ state: 'open', labels: [], boardStatus: 'Done' }, 'Verified', board).noop).toBe(false);
  });

  it('cannot move to a column the board has no Status for, and says so instead of guessing', () => {
    for (const column of ['Ready', 'Blocked', 'Review'] as const) {
      const plan = planMove({ state: 'open', labels: [], boardStatus: 'Todo' }, column, board);
      expect(plan).toMatchObject({ unavailable: true, noop: false });
      expect(plan.projectStatus).toBeUndefined();
    }
  });

  it('uses a board option the process maps to the column', () => {
    const custom = rulesOf('columns:\n  source: board-status\n  board:\n    Next: Ready\n    Doing: In progress\n    Done: Verified\n');
    expect(planMove({ state: 'open', labels: [], boardStatus: 'Doing' }, 'Ready', custom).projectStatus).toBe('Next');
  });
});

describe('boardGaps with the rules of a repository', () => {
  it('has nothing to compare when the board is the source', () => {
    expect(boardGaps('Review', [{ project: 'P', status: 'Todo' }], undefined, board)).toEqual([]);
    expect(boardGaps('Review', [{ project: 'P', status: 'Todo' }])).toHaveLength(1);
  });
});

describe('findMismatches for a repository whose board is the source', () => {
  const card = (repository: string): MismatchCard => ({
    repository,
    number: 1,
    title: 'x',
    url: `https://github.com/${repository}/issues/1`,
    boardStatus: 'Todo',
    placement: { column: 'Review', gaps: [] },
  });

  it('does not report the board as different from the column it decided', () => {
    const input = { artifacts: [], repositories: ['me/a', 'me/b'], cards: [card('me/a'), card('me/b')] };
    expect(findMismatches(input).map((m) => m.args.repository)).toEqual(['me/a', 'me/b']);
    expect(findMismatches({ ...input, boardSourced: ['ME/A'] }).map((m) => m.args.repository)).toEqual(['me/b']);
  });
});
