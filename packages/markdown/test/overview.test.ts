import { describe, expect, it } from 'vitest';
import { applyLaneOrder, buildLanes, focusCards, loadWorkspace, parseFabric, placeIssue, requirementsByIssue, moveLane } from '../src';

const registry = (text: string) => {
  const { registry: parsed } = parseFabric('fabric.yaml', text);
  if (!parsed) throw new Error('bad test registry');
  return parsed;
};

const card = (repository: string, number: number, labels: string[] = ['status:backlog'], state: 'open' | 'closed' = 'open') => ({
  repository,
  number,
  placement: placeIssue({ state, labels }),
});

describe('buildLanes', () => {
  const reg = registry('project: {owner: o, number: 1}\nrepositories:\n  - o/Zed\n  - repository: o/Alpha\n    title: First one\n  - o/Empty\n');

  it('makes one lane per registered repository, in registry order, even without cards', () => {
    const lanes = buildLanes(reg, [card('o/Alpha', 1)]);
    expect(lanes.map((l) => l.repository)).toEqual(['o/Zed', 'o/Alpha', 'o/Empty']);
    expect(lanes.map((l) => l.total)).toEqual([0, 1, 0]);
  });

  it('uses the entry title, or the repository name', () => {
    expect(buildLanes(reg, []).map((l) => l.title)).toEqual(['Zed', 'First one', 'Empty']);
  });

  it('puts each card in its repository lane and column, ignoring case', () => {
    const lanes = buildLanes(reg, [
      card('O/alpha', 3, ['status:review']),
      card('o/Alpha', 1, ['status:backlog']),
      card('o/Zed', 9, ['status:verified'], 'closed'),
    ]);
    expect(lanes[1].columns.Review.map((c) => c.number)).toEqual([3]);
    expect(lanes[1].columns.Backlog.map((c) => c.number)).toEqual([1]);
    expect(lanes[0].columns.Verified.map((c) => c.number)).toEqual([9]);
  });

  it('orders cards of a column by Issue number', () => {
    const lanes = buildLanes(reg, [card('o/Zed', 5), card('o/Zed', 2), card('o/Zed', 8)]);
    expect(lanes[0].columns.Backlog.map((c) => c.number)).toEqual([2, 5, 8]);
  });

  it('ignores cards of repositories that are not registered', () => {
    const lanes = buildLanes(reg, [card('o/Other', 1)]);
    expect(lanes.reduce((sum, l) => sum + l.total, 0)).toBe(0);
  });

  it('counts blocked cards so a collapsed lane can still show them', () => {
    const lanes = buildLanes(reg, [card('o/Zed', 1, ['status:blocked']), card('o/Zed', 2, ['status:blocked']), card('o/Zed', 3)]);
    expect(lanes[0]).toMatchObject({ total: 3, blocked: 2 });
  });
});

describe('applyLaneOrder', () => {
  const lanes = ['o/A', 'o/B', 'o/C', 'o/D'].map((repository) => ({ repository }));
  const names = (list: { repository: string }[]) => list.map((l) => l.repository);

  it('keeps the registry order when nothing was chosen', () => {
    expect(names(applyLaneOrder(lanes, []))).toEqual(['o/A', 'o/B', 'o/C', 'o/D']);
  });

  it('puts the chosen lanes first in the chosen order and leaves the rest in registry order', () => {
    expect(names(applyLaneOrder(lanes, ['o/C', 'o/A']))).toEqual(['o/C', 'o/A', 'o/B', 'o/D']);
  });

  it('ignores a name that is no longer registered and compares without case', () => {
    expect(names(applyLaneOrder(lanes, ['o/gone', 'O/d']))).toEqual(['o/D', 'o/A', 'o/B', 'o/C']);
  });
});

describe('moveLane', () => {
  const full = ['o/A', 'o/B', 'o/C', 'o/D'];

  it('moves a lane up or down by one step', () => {
    expect(moveLane(full, full, 'o/B', -1)).toEqual(['o/B', 'o/A', 'o/C', 'o/D']);
    expect(moveLane(full, full, 'o/B', 1)).toEqual(['o/A', 'o/C', 'o/B', 'o/D']);
  });

  it('does nothing at either end', () => {
    expect(moveLane(full, full, 'o/A', -1)).toEqual(full);
    expect(moveLane(full, full, 'o/D', 1)).toEqual(full);
  });

  it('swaps with the neighbor that is shown, skipping a hidden lane', () => {
    // B is hidden: moving C up swaps it with A, so the move is visible.
    expect(moveLane(full, ['o/A', 'o/C', 'o/D'], 'o/C', -1)).toEqual(['o/C', 'o/B', 'o/A', 'o/D']);
  });

  it('leaves the order alone for a lane that is not shown, and does not change its input', () => {
    const copy = [...full];
    expect(moveLane(full, ['o/A', 'o/C'], 'o/B', 1)).toEqual(full);
    expect(full).toEqual(copy);
  });
});

describe('focusCards', () => {
  const link = (id: string, taskId: string) => ({ id, title: id, path: `${id}.md`, taskId });
  const links = new Map([
    ['https://github.com/o/a/issues/1', link('REQ-001', 'TASK-001')],
    ['https://github.com/o/a/issues/2', link('REQ-001', 'TASK-002')],
    ['https://github.com/o/a/issues/3', link('REQ-002', 'TASK-003')],
  ]);
  const cards = [1, 2, 3, 4].map((n) => ({ url: `https://github.com/O/A/issues/${n}/` }));

  it('returns every card of a requirement, in the order of the cards', () => {
    expect(focusCards(cards, links, { requirementId: 'REQ-001' })).toEqual([cards[0], cards[1]]);
  });

  it('returns only the card of the task when a task is given', () => {
    expect(focusCards(cards, links, { requirementId: 'REQ-001', taskId: 'TASK-002' })).toEqual([cards[1]]);
  });

  it('returns nothing for a requirement or task with no card, or for a card with no link', () => {
    expect(focusCards(cards, links, { requirementId: 'REQ-009' })).toEqual([]);
    expect(focusCards(cards, links, { requirementId: 'REQ-001', taskId: 'TASK-003' })).toEqual([]);
    expect(focusCards([cards[3]], links, { requirementId: 'REQ-001' })).toEqual([]);
  });
});

describe('requirementsByIssue', () => {
  const files = [
    {
      path: 'REQ-001.md',
      text: '---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\n---\n\n## Tasks\n\n- `TASK-001` Do it — [GitHub Issue #1](https://github.com/o/a/issues/1)\n',
    },
    {
      path: 'REQ-002.md',
      text: '---\nid: REQ-002\ntype: requirement\ntitle: Second\nstatus: draft\n---\n\n## Tasks\n',
    },
    {
      path: 'TASK-002.md',
      text: '---\nid: TASK-002\ntype: task\ntitle: Other\nrequirement: REQ-002\nstatus: draft\nissue: https://github.com/O/A/issues/2/\n---\n',
    },
    {
      path: 'TASK-003.md',
      text: '---\nid: TASK-003\ntype: task\ntitle: Orphan\nrequirement: REQ-999\nstatus: draft\nissue: https://github.com/o/a/issues/3\n---\n',
    },
  ];
  const map = requirementsByIssue(loadWorkspace(files).artifacts);

  it('reads the Issue of a task listed under its requirement', () => {
    expect(map.get('https://github.com/o/a/issues/1')).toEqual({ id: 'REQ-001', title: 'First', path: 'REQ-001.md', taskId: 'TASK-001' });
  });

  it('reads the Issue of a task file, ignoring case and a trailing slash', () => {
    expect(map.get('https://github.com/o/a/issues/2')).toEqual({
      id: 'REQ-002',
      title: 'Second',
      path: 'REQ-002.md',
      taskId: 'TASK-002',
      taskPath: 'TASK-002.md',
    });
  });

  it('takes the task file path when the task has a file, and leaves it out when it has none', () => {
    expect(map.get('https://github.com/o/a/issues/2')?.taskPath).toBe('TASK-002.md');
    expect(map.get('https://github.com/o/a/issues/1')).not.toHaveProperty('taskPath');
  });

  it('has no entry for a task whose requirement does not exist, or for an unknown Issue', () => {
    expect(map.get('https://github.com/o/a/issues/3')).toBeUndefined();
    expect(map.get('https://github.com/o/a/issues/99')).toBeUndefined();
  });
});
