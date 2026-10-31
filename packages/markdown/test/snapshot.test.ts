import { describe, expect, it } from 'vitest';
import { makeSnapshot, readSnapshot, snapshotAge } from '../src';

const project = { owner: 'o', number: 1 };
const card = { repository: 'o/a', number: 1, title: 'x', url: 'https://github.com/o/a/issues/1', placement: { column: 'Ready', gaps: [] } };
const now = new Date('2026-11-01T12:00:00Z');

describe('readSnapshot', () => {
  it('returns what makeSnapshot kept, after a round trip through JSON', () => {
    const kept = JSON.parse(JSON.stringify(makeSnapshot(project, 'Board', [card], now)));
    expect(readSnapshot(kept, project)?.cards).toHaveLength(1);
    expect(readSnapshot(kept, project)?.readAt).toBe(now.toISOString());
  });

  it('ignores a read of another Project, comparing the owner without case', () => {
    const kept = makeSnapshot(project, 'Board', [card], now);
    expect(readSnapshot(kept, { owner: 'O', number: 1 })).toBeDefined();
    expect(readSnapshot(kept, { owner: 'o', number: 2 })).toBeUndefined();
    expect(readSnapshot(kept, { owner: 'other', number: 1 })).toBeUndefined();
  });

  it('ignores damaged or unknown data', () => {
    expect(readSnapshot(undefined, project)).toBeUndefined();
    expect(readSnapshot('text', project)).toBeUndefined();
    expect(readSnapshot({ ...makeSnapshot(project, 'B', [card], now), version: 2 }, project)).toBeUndefined();
    expect(readSnapshot({ ...makeSnapshot(project, 'B', [card], now), readAt: 'yesterday' }, project)).toBeUndefined();
    expect(readSnapshot(makeSnapshot(project, 'B', [{ ...card, placement: undefined }], now), project)).toBeUndefined();
    expect(readSnapshot({ ...makeSnapshot(project, 'B', [card], now), cards: 'none' }, project)).toBeUndefined();
  });
});

describe('snapshotAge', () => {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it('uses the largest whole unit', () => {
    expect(snapshotAge(ago(5 * 60000), now)).toEqual({ unit: 'minutes', count: 5 });
    expect(snapshotAge(ago(3 * 3600000 + 59 * 60000), now)).toEqual({ unit: 'hours', count: 3 });
    expect(snapshotAge(ago(50 * 3600000), now)).toEqual({ unit: 'days', count: 2 });
  });

  it('counts under a minute, and a clock that ran backwards, as one minute', () => {
    expect(snapshotAge(ago(10000), now)).toEqual({ unit: 'minutes', count: 1 });
    expect(snapshotAge(ago(-600000), now)).toEqual({ unit: 'minutes', count: 1 });
  });
});
