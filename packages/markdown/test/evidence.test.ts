import { describe, expect, it } from 'vitest';
import { describePull, evidenceGaps, summarizeChecks } from '../src';

const pull = (over: Partial<Parameters<typeof describePull>[0]> = {}) => ({
  number: 7, title: 't', url: 'u', state: 'merged' as const, checks: 'passing' as const, ...over,
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
  it('ignores pull requests closed without merging', () => {
    expect(evidenceGaps('Review', { pulls: [pull({ state: 'closed', checks: 'none' }), pull({ number: 9 })] })).toEqual([]);
  });
  it('says so when evidence was not loaded', () => {
    expect(evidenceGaps('Verified', undefined)).toEqual(['evidence not loaded']);
  });
});

describe('describePull', () => {
  it('summarizes state and checks', () => {
    expect(describePull(pull())).toBe('PR #7 merged · checks passing');
    expect(describePull(pull({ checks: 'none', state: 'open' }))).toBe('PR #8 open · no checks'.replace('#8', '#7'));
  });
});
