import { describe, expect, it } from 'vitest';
import { defaultProcess, evidenceGaps, findMismatches, honoredException, parseProcess, staleNotices, type EvidenceRules, type MismatchCard, type PullEvidence, type TaskEvidence } from '../src';

const rulesOf = (yaml: string): EvidenceRules => parseProcess('.weaver/process.yaml', yaml).process.evidence;
const optional = rulesOf('evidence:\n  pull-request: optional\n');
const noClosing = rulesOf('evidence:\n  closing-pull-request: false\n');
const noExceptions = rulesOf('evidence:\n  exceptions: false\n');

const pull = (extra: Partial<PullEvidence> = {}): PullEvidence => ({ number: 7, title: 'x', url: 'u', state: 'merged', checks: 'passing', link: 'closes', ...extra });
const evidence = (...pulls: PullEvidence[]): TaskEvidence => ({ pulls });
const codes = (gaps: { code: string }[]) => gaps.map((gap) => gap.code);

describe('evidenceGaps with the rules of a repository', () => {
  it('gives the same answer with the default rules as without any', () => {
    const rules = defaultProcess().evidence;
    for (const column of ['Backlog', 'In progress', 'Review', 'Verified'] as const) {
      for (const e of [undefined, evidence(), evidence(pull()), evidence(pull({ state: 'open', link: 'mentions', checks: 'failing' })), evidence(pull({ link: 'mentions' }))]) {
        expect(evidenceGaps(column, e, rules)).toEqual(evidenceGaps(column, e));
      }
    }
  });

  it('expects a pull request by default, and not when the process says it is optional', () => {
    expect(codes(evidenceGaps('Review', evidence()))).toEqual(['gap.no-linked-pr']);
    expect(evidenceGaps('Review', evidence(), optional)).toEqual([]);
    expect(evidenceGaps('Verified', evidence(), optional)).toEqual([]);
  });

  it('still reports problems of a pull request that exists when pull requests are optional', () => {
    expect(codes(evidenceGaps('Review', evidence(pull({ state: 'open', checks: 'failing' })), optional))).toEqual(['gap.checks-failing']);
    expect(codes(evidenceGaps('Verified', evidence(pull({ state: 'open' })), optional))).toEqual(['gap.no-merged-pr']);
  });

  it('still says nothing was loaded, whatever the rules', () => {
    expect(codes(evidenceGaps('Review', undefined, optional))).toEqual(['gap.evidence-not-loaded']);
  });

  it('wants a merged pull request that closes the Issue only when the process says so', () => {
    const mentionOnly = evidence(pull({ link: 'mentions' }));
    expect(codes(evidenceGaps('Verified', mentionOnly))).toEqual(['gap.no-closing-pr']);
    expect(evidenceGaps('Verified', mentionOnly, noClosing)).toEqual([]);
    expect(codes(evidenceGaps('Verified', evidence(pull({ state: 'open' })), noClosing))).toEqual(['gap.no-merged-pr']);
  });
});

describe('honoredException', () => {
  it('keeps the reason by default and drops it when the process does not honor exceptions', () => {
    expect(honoredException('before the rule')).toBe('before the rule');
    expect(honoredException('before the rule', defaultProcess().evidence)).toBe('before the rule');
    expect(honoredException('before the rule', noExceptions)).toBeUndefined();
    expect(honoredException(undefined, noExceptions)).toBeUndefined();
  });
});

describe('staleNotices with the rules of a repository', () => {
  const now = new Date('2026-11-01T00:00:00Z');
  it('marks a card in Review without a pull request unless pull requests are optional', () => {
    expect(staleNotices({ column: 'Review', pullCount: 0 }, now).map((n) => n.code)).toEqual(['stale.no-evidence']);
    expect(staleNotices({ column: 'Review', pullCount: 0, pullRequest: 'required' }, now).map((n) => n.code)).toEqual(['stale.no-evidence']);
    expect(staleNotices({ column: 'Review', pullCount: 0, pullRequest: 'optional' }, now)).toEqual([]);
  });
});

describe('findMismatches with the evidence rules of a repository', () => {
  const card: MismatchCard = { repository: 'me/a', number: 5, title: 'x', url: 'https://github.com/me/a/issues/5', taskId: 'TASK-010', state: 'open', placement: { column: 'Review', gaps: [] } };
  const pulls = [{ repository: 'me/a', number: 7, title: 'feat: ten (TASK-010)', url: 'https://github.com/me/a/pull/7', branch: 'feat/task-010', closes: [] }];
  const task = (extra = '') => ({
    kind: 'task' as const,
    id: 'TASK-010',
    path: 'tasks/TASK-010.md',
    title: 'ten',
    requirement: 'REQ-001',
    repository: 'me/a',
    ...(extra ? { evidenceException: extra } : {}),
  });
  const input = { cards: [card], repositories: ['me/a'], pulls };
  const artifacts = (extra = '') => [{ ...task(extra), issue: 'https://github.com/me/a/issues/5' }] as never;
  /** The task files here are bare; only the pull request check is of interest. */
  const notLinked = (extra: Partial<Parameters<typeof findMismatches>[0]> & { reason?: string } = {}) =>
    findMismatches({ ...input, artifacts: artifacts(extra.reason), ...extra }).filter((m) => m.kind === 'merged-pr-not-linked');

  it('reports a merged pull request that does not close the Issue by default', () => {
    expect(notLinked()).toHaveLength(1);
  });

  it('does not when the repository does not need a closing pull request', () => {
    expect(notLinked({ closingNotRequired: ['ME/A'] })).toEqual([]);
  });

  it('skips a task with an exception, unless the repository does not honor exceptions', () => {
    expect(notLinked({ reason: 'reason' })).toEqual([]);
    expect(notLinked({ reason: 'reason', exceptionsIgnored: ['me/a'] })).toHaveLength(1);
  });
});
