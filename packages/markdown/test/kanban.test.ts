import { describe, expect, it } from 'vitest';
import { groupByColumn, parseIssueUrl, placeIssue } from '../src';

describe('placeIssue', () => {
  it('maps each status label to its column', () => {
    expect(placeIssue({ state: 'open', labels: ['task', 'status:ready'] })).toEqual({ column: 'Ready', gaps: [] });
    expect(placeIssue({ state: 'open', labels: ['status:in-progress'] }).column).toBe('In progress');
    expect(placeIssue({ state: 'open', labels: ['status:blocked'] }).column).toBe('Blocked');
    expect(placeIssue({ state: 'open', labels: ['status:review'] }).column).toBe('Review');
    expect(placeIssue({ state: 'closed', labels: ['status:verified'] })).toEqual({ column: 'Verified', gaps: [] });
  });

  it('puts an unlabeled open issue in Backlog and flags it', () => {
    expect(placeIssue({ state: 'open', labels: ['task'] })).toEqual({ column: 'Backlog', gaps: ['no status label'] });
  });

  it('flags a closed issue without verification evidence', () => {
    const placement = placeIssue({ state: 'closed', labels: ['status:review'] });
    expect(placement.column).toBe('Review');
    expect(placement.gaps[0]).toContain('verification gap');
  });

  it('flags an open issue labeled verified', () => {
    const placement = placeIssue({ state: 'open', labels: ['status:verified'] });
    expect(placement.column).toBe('Verified');
    expect(placement.gaps).toEqual(['open but labeled status:verified']);
  });

  it('flags multiple status labels and uses the earliest column', () => {
    const placement = placeIssue({ state: 'open', labels: ['status:review', 'status:ready'] });
    expect(placement.column).toBe('Ready');
    expect(placement.gaps[0]).toContain('multiple status labels');
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
