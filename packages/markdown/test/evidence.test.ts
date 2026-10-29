import { describe, expect, it } from 'vitest';
import { closesIssue, describePull, evidenceGaps, summarizeChecks } from '../src';

const pull = (over: Partial<Parameters<typeof describePull>[0]> = {}) => ({
  number: 7, title: 't', url: 'u', state: 'merged' as const, checks: 'passing' as const, link: 'closes' as const, ...over,
});

describe('summarizeChecks', () => {
  it('reports none when there are no runs', () => {
    expect(summarizeChecks([])).toBe('none');
  });
  it('passes only when every run completed without failure', () => {
    expect(summarizeChecks([{ status: 'completed', conclusion: 'success' }, { status: 'completed', conclusion: 'skipped' }])).toBe('passing');
  });
  it('fails when any run failed, even if others are pending', () => {
    expect(summarizeChecks([{ status: 'completed', conclusion: 'failure' }, { status: 'in_progress', conclusion: null }])).toBe('failing');
  });
  it('is pending while a run is unfinished', () => {
    expect(summarizeChecks([{ status: 'completed', conclusion: 'success' }, { status: 'queued', conclusion: null }])).toBe('pending');
  });
});

describe('evidenceGaps', () => {
  it('demands nothing before Review', () => {
    expect(evidenceGaps('In progress', { pulls: [] })).toEqual([]);
    expect(evidenceGaps('Backlog', undefined)).toEqual([]);
  });
  it('flags a Review task without a pull request', () => {
    expect(evidenceGaps('Review', { pulls: [] })).toEqual(['no linked pull request']);
  });
  it('flags Verified without a merged pull request', () => {
    expect(evidenceGaps('Verified', { pulls: [pull({ state: 'open' })] })).toContain('no merged pull request');
  });
  it('accepts a merged pull request with passing checks', () => {
    expect(evidenceGaps('Verified', { pulls: [pull()] })).toEqual([]);
  });
  it('flags failing, pending, and missing checks', () => {
    expect(evidenceGaps('Review', { pulls: [pull({ checks: 'failing' })] })).toEqual(['PR #7 has failing checks']);
    expect(evidenceGaps('Review', { pulls: [pull({ checks: 'pending' })] })).toEqual(['PR #7 checks are still running']);
    expect(evidenceGaps('Review', { pulls: [pull({ checks: 'none' })] })).toEqual(['PR #7 has no check results']);
  });
  it('groups pull requests that share a check state into one line', () => {
    const pulls = [pull({ number: 6, checks: 'none' }), pull({ number: 7, checks: 'none' }), pull({ number: 9, checks: 'failing' })];
    expect(evidenceGaps('Verified', { pulls })).toEqual(['PR #9 has failing checks', 'PRs #6, #7 have no check results']);
  });
  it('ignores pull requests closed without merging', () => {
    expect(evidenceGaps('Review', { pulls: [pull({ state: 'closed', checks: 'none' }), pull({ number: 9 })] })).toEqual([]);
  });
  it('says so when evidence was not loaded', () => {
    expect(evidenceGaps('Verified', undefined)).toEqual(['evidence not loaded']);
  });
});

describe('describePull', () => {
  it('summarizes state and checks', () => {
    expect(describePull(pull())).toBe('PR #7 merged · checks passing · closes Issue');
    expect(describePull(pull({ checks: 'none', state: 'open' }))).toBe('PR #7 open · no checks · closes Issue');
    expect(describePull(pull({ link: 'mentions' }))).toBe('PR #7 merged · checks passing · mentions Issue');
  });
});

describe('closesIssue', () => {
  it('accepts GitHub closing keywords for the same Issue', () => {
    expect(closesIssue('Closes #5', 5)).toBe(true);
    expect(closesIssue('fixed #5 and more', 5)).toBe(true);
    expect(closesIssue('Resolves: blcktgr73/Weaver#5', 5)).toBe(true);
  });
  it('treats a bare reference or another Issue as a mention', () => {
    expect(closesIssue('See #5 for context', 5)).toBe(false);
    expect(closesIssue('Closes #50', 5)).toBe(false);
    expect(closesIssue('Closes #6', 5)).toBe(false);
    expect(closesIssue('TASK-005 relates', 5)).toBe(false);
    expect(closesIssue(null, 5)).toBe(false);
  });
});
