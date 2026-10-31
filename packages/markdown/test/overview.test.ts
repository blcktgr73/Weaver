import { describe, expect, it } from 'vitest';
import { buildLanes, loadWorkspace, parseFabric, placeIssue, requirementsByIssue } from '../src';

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
    expect(map.get('https://github.com/o/a/issues/1')).toEqual({ id: 'REQ-001', title: 'First' });
  });

  it('reads the Issue of a task file, ignoring case and a trailing slash', () => {
    expect(map.get('https://github.com/o/a/issues/2')).toEqual({ id: 'REQ-002', title: 'Second' });
  });

  it('has no entry for a task whose requirement does not exist, or for an unknown Issue', () => {
    expect(map.get('https://github.com/o/a/issues/3')).toBeUndefined();
    expect(map.get('https://github.com/o/a/issues/99')).toBeUndefined();
  });
});
