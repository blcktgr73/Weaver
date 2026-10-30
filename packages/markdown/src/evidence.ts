import { Locale, Notice, t } from './i18n';
import { KanbanColumn } from './kanban';

export type ChecksState = 'passing' | 'failing' | 'pending' | 'none';

export interface PullEvidence {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  checks: ChecksState;
  /** `closes` when the PR text says it closes the Issue; otherwise it only mentions it. */
  link: 'closes' | 'mentions';
}

export interface TaskEvidence {
  /** Pull requests that reference the task's Issue. A reference is a link, not proof. */
  pulls: PullEvidence[];
}

export interface CheckRunLike {
  status: string;
  conclusion: string | null;
}

const FAILING = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale']);

/** Collapses a commit's check runs into one state. */
export function summarizeChecks(runs: CheckRunLike[]): ChecksState {
  if (runs.length === 0) return 'none';
  if (runs.some((run) => run.status === 'completed' && run.conclusion && FAILING.has(run.conclusion))) return 'failing';
  if (runs.some((run) => run.status !== 'completed')) return 'pending';
  return 'passing';
}

/**
 * Gaps between where a task sits and the evidence behind it.
 * Evidence is only demanded once a task claims to be in review or verified;
 * it reports gaps and never decides acceptance.
 */
export function evidenceGaps(column: KanbanColumn, evidence: TaskEvidence | undefined): Notice[] {
  if (column !== 'Review' && column !== 'Verified') return [];
  if (!evidence) return [{ code: 'gap.evidence-not-loaded' }];
  if (evidence.pulls.length === 0) return [{ code: 'gap.no-linked-pr' }];

  const gaps: Notice[] = [];
  if (column === 'Verified' && !evidence.pulls.some((pull) => pull.state === 'merged')) {
    gaps.push({ code: 'gap.no-merged-pr' });
  } else if (
    column === 'Verified' &&
    !evidence.pulls.some((pull) => pull.state === 'merged' && pull.link === 'closes')
  ) {
    gaps.push({ code: 'gap.no-closing-pr' });
  }
  // closed without merge is not evidence either way
  const live = evidence.pulls.filter((pull) => pull.state !== 'closed');
  gaps.push(...groupedPullGap(live, 'failing', 'gap.checks-failing'));
  gaps.push(...groupedPullGap(live, 'pending', 'gap.checks-pending'));
  gaps.push(...groupedPullGap(live, 'none', 'gap.checks-none'));
  return gaps;
}

/** One notice per check state, so four old PRs do not produce four warnings. */
function groupedPullGap(
  pulls: PullEvidence[],
  state: ChecksState,
  code: 'gap.checks-failing' | 'gap.checks-pending' | 'gap.checks-none',
): Notice[] {
  const matching = pulls.filter((pull) => pull.checks === state).map((pull) => `#${pull.number}`);
  return matching.length === 0 ? [] : [{ code, args: { prs: matching, count: matching.length } }];
}

export function describePull(pull: PullEvidence, locale: Locale = 'en'): string {
  return t('pull.summary', locale, {
    number: pull.number,
    state: t(`pull.state.${pull.state}`, locale),
    checks: t(`pull.checks.${pull.checks}`, locale),
    link: t(`pull.link.${pull.link}`, locale),
  });
}

const CLOSING_WORD = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:[\w.-]+\/[\w.-]+)?#(\d+)\b/gi;

/**
 * Whether PR text uses GitHub's closing keywords for this Issue ("Closes #5").
 * A plain "#5" or "TASK-005" is only a mention.
 */
export function closesIssue(text: string | null | undefined, issueNumber: number): boolean {
  if (!text) return false;
  for (const match of text.matchAll(CLOSING_WORD)) {
    if (Number(match[1]) === issueNumber) return true;
  }
  return false;
}
