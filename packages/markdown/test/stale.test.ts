import { describe, expect, it } from 'vitest';
import { DEFAULT_STALE_DAYS, formatNotice, staleNotices } from '../src';

const NOW = new Date('2026-11-01T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const codes = (input: Parameters<typeof staleNotices>[0], idle?: number) => staleNotices(input, NOW, idle).map((n) => n.code);

describe('staleNotices', () => {
  it('marks an active card that has not changed for the limit or longer', () => {
    expect(codes({ column: 'In progress', updatedAt: daysAgo(14) })).toEqual(['stale.idle']);
    expect(codes({ column: 'In progress', updatedAt: daysAgo(13) })).toEqual([]);
  });

  it('uses the given limit, and the default is two weeks', () => {
    expect(DEFAULT_STALE_DAYS).toBe(14);
    expect(codes({ column: 'Review', updatedAt: daysAgo(3) }, 3)).toEqual(['stale.idle']);
    expect(codes({ column: 'Review', updatedAt: daysAgo(3) }, 4)).toEqual([]);
    // A limit below one day is read as one day, so a card changed today is never idle.
    expect(codes({ column: 'Review', updatedAt: daysAgo(0) }, 0)).toEqual([]);
    expect(codes({ column: 'Review', updatedAt: daysAgo(1) }, 0)).toEqual(['stale.idle']);
  });

  it('counts whole days in the notice', () => {
    expect(staleNotices({ column: 'Blocked', updatedAt: daysAgo(20) }, NOW)[0]).toEqual({ code: 'stale.idle', args: { days: 20, count: 20 } });
  });

  it('does not call a Backlog or Verified card idle', () => {
    expect(codes({ column: 'Backlog', updatedAt: daysAgo(400) })).toEqual([]);
    expect(codes({ column: 'Verified', updatedAt: daysAgo(400), pullCount: 1 })).toEqual([]);
  });

  it('never calls a closed Issue idle, even when the label rules put it in Review', () => {
    expect(codes({ column: 'Review', state: 'closed', updatedAt: daysAgo(400) })).toEqual([]);
    expect(codes({ column: 'Review', state: 'open', updatedAt: daysAgo(400) })).toEqual(['stale.idle']);
  });

  it('ignores a missing or unreadable date', () => {
    expect(codes({ column: 'In progress' })).toEqual([]);
    expect(codes({ column: 'In progress', updatedAt: 'not a date' })).toEqual([]);
  });

  it('marks Review and Verified cards that have no pull request at all', () => {
    expect(codes({ column: 'Review', pullCount: 0 })).toEqual(['stale.no-evidence']);
    expect(codes({ column: 'Verified', pullCount: 0 })).toEqual(['stale.no-evidence']);
    expect(codes({ column: 'In progress', pullCount: 0 })).toEqual([]);
    expect(codes({ column: 'Review', pullCount: 2 })).toEqual([]);
  });

  it('does not guess when the pull request count was not read, or when an exception covers the task', () => {
    expect(codes({ column: 'Review' })).toEqual([]);
    expect(codes({ column: 'Verified', pullCount: 0, evidenceException: true })).toEqual([]);
  });

  it('marks a card that waits for a human decision, unless it is already verified', () => {
    expect(codes({ column: 'Blocked', needsDecision: true })).toEqual(['stale.needs-decision']);
    expect(codes({ column: 'Verified', needsDecision: true, pullCount: 1 })).toEqual([]);
  });

  it('gives the three reasons apart, in a fixed order', () => {
    expect(codes({ column: 'Review', updatedAt: daysAgo(30), pullCount: 0, needsDecision: true })).toEqual([
      'stale.idle',
      'stale.no-evidence',
      'stale.needs-decision',
    ]);
  });

  it('has a message in English and Korean, with the day count in the plural form', () => {
    const idle = staleNotices({ column: 'Review', updatedAt: daysAgo(1) }, NOW, 1)[0];
    expect(formatNotice(idle, 'en')).toBe('no change for 1 day');
    expect(formatNotice({ code: 'stale.idle', args: { days: 5, count: 5 } }, 'en')).toBe('no change for 5 days');
    expect(formatNotice({ code: 'stale.idle', args: { days: 5, count: 5 } }, 'ko')).toContain('5');
    for (const code of ['stale.no-evidence', 'stale.needs-decision'] as const) {
      expect(formatNotice({ code }, 'ko')).not.toBe(code);
    }
  });
});
