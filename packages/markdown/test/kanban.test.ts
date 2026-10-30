import { describe, expect, it } from 'vitest';
import { describeMove, formatNotice, groupByColumn, parseIssueUrl, placeIssue, planMove } from '../src';

describe('placeIssue', () => {
  it('maps each status label to its column', () => {
    expect(placeIssue({ state: 'open', labels: ['task', 'status:ready'] })).toEqual({ column: 'Ready', gaps: [] });
    expect(placeIssue({ state: 'open', labels: ['status:in-progress'] }).column).toBe('In progress');
    expect(placeIssue({ state: 'open', labels: ['status:blocked'] }).column).toBe('Blocked');
    expect(placeIssue({ state: 'open', labels: ['status:review'] }).column).toBe('Review');
    expect(placeIssue({ state: 'closed', labels: ['status:verified'] })).toEqual({ column: 'Verified', gaps: [] });
  });

  it('puts an unlabeled open issue in Backlog and flags it', () => {
    expect(placeIssue({ state: 'open', labels: ['task'] })).toEqual({ column: 'Backlog', gaps: [{ code: 'gap.no-status-label' }] });
  });

  it('flags a closed issue without verification evidence', () => {
    const placement = placeIssue({ state: 'closed', labels: ['status:review'] });
    expect(placement.column).toBe('Review');
    expect(placement.gaps[0].code).toBe('gap.closed-without-verified');
  });

  it('flags an open issue labeled verified', () => {
    const placement = placeIssue({ state: 'open', labels: ['status:verified'] });
    expect(placement.column).toBe('Verified');
    expect(placement.gaps).toEqual([{ code: 'gap.open-but-verified' }]);
  });

  it('flags multiple status labels and uses the earliest column', () => {
    const placement = placeIssue({ state: 'open', labels: ['status:review', 'status:ready'] });
    expect(placement.column).toBe('Ready');
    expect(placement.gaps[0].code).toBe('gap.multiple-status-labels');
  });
});

describe('groupByColumn', () => {
  it('returns every column, empty ones included', () => {
    const grouped = groupByColumn([{ id: 'a', placement: { column: 'Ready', gaps: [] } }]);
    expect(Object.keys(grouped)).toHaveLength(6);
    expect(grouped.Ready).toHaveLength(1);
    expect(grouped.Blocked).toEqual([]);
  });
});

describe('parseIssueUrl', () => {
  it('parses GitHub issue URLs only', () => {
    expect(parseIssueUrl('https://github.com/blcktgr73/Weaver/issues/5')).toEqual({
      owner: 'blcktgr73', repo: 'Weaver', number: 5,
    });
    expect(parseIssueUrl('https://github.com/blcktgr73/Weaver/pull/5')).toBeUndefined();
    expect(parseIssueUrl('https://evil.example/blcktgr73/Weaver/issues/5')).toBeUndefined();
  });
});

describe('planMove', () => {
  it('moves an open Ready issue to In progress', () => {
    const plan = planMove({ state: 'open', labels: ['task', 'status:ready'] }, 'In progress');
    expect(plan).toEqual({
      column: 'In progress',
      addLabel: 'status:in-progress',
      removeLabels: ['status:ready'],
      state: 'open',
      projectStatus: 'In Progress',
      noop: false,
    });
  });

  it('closing for Verified sets state closed and board Done', () => {
    const plan = planMove({ state: 'open', labels: ['status:review'] }, 'Verified');
    expect(plan).toMatchObject({ state: 'closed', projectStatus: 'Done', removeLabels: ['status:review'] });
  });

  it('reopens when moving a closed issue back', () => {
    const plan = planMove({ state: 'closed', labels: ['status:verified'] }, 'Review');
    expect(plan).toMatchObject({ state: 'open', addLabel: 'status:review', removeLabels: ['status:verified'] });
  });

  it('never removes non-status labels', () => {
    const plan = planMove({ state: 'open', labels: ['task', 'area:vscode', 'status:backlog'] }, 'Ready');
    expect(plan.removeLabels).toEqual(['status:backlog']);
  });

  it('is a no-op when already in place', () => {
    expect(planMove({ state: 'open', labels: ['status:blocked'] }, 'Blocked').noop).toBe(true);
    expect(planMove({ state: 'open', labels: ['status:verified'] }, 'Verified').noop).toBe(false);
  });

  it('collapses six columns onto the three board values', () => {
    const statuses = ['Backlog', 'Ready', 'In progress', 'Blocked', 'Review', 'Verified'].map(
      (c) => planMove({ state: 'open', labels: [] }, c as never).projectStatus,
    );
    expect(statuses).toEqual(['Todo', 'Todo', 'In Progress', 'In Progress', 'In Progress', 'Done']);
  });
});

describe('describeMove', () => {
  it('lists each change', () => {
    const issue = { state: 'open' as const, labels: ['status:review'] };
    const lines = describeMove(planMove(issue, 'Verified'), issue);
    expect(lines.map((n) => formatNotice(n, 'en'))).toEqual([
      'Remove label: status:review',
      'Add label: status:verified',
      'Close the Issue',
      'Set board Status: Done',
    ]);
    expect(lines.map((n) => formatNotice(n, 'ko'))).toEqual([
      '라벨 제거: status:review',
      '라벨 추가: status:verified',
      'Issue 닫기',
      '보드 Status 설정: Done',
    ]);
  });
});
