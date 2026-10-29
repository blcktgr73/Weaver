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
export function evidenceGaps(column: KanbanColumn, evidence: TaskEvidence | undefined): string[] {
  if (column !== 'Review' && column !== 'Verified') return [];
  if (!evidence) return ['evidence not loaded'];

  const gaps: string[] = [];
  if (evidence.pulls.length === 0) {
    gaps.push('no linked pull request');
    return gaps;
  }
  if (column === 'Verified' && !evidence.pulls.some((pull) => pull.state === 'merged')) {
    gaps.push('no merged pull request');
  }
  // closed without merge is not evidence either way
  const live = evidence.pulls.filter((pull) => pull.state !== 'closed');
  gaps.push(...groupedPullGap(live, 'failing', 'has failing checks', 'have failing checks'));
  gaps.push(...groupedPullGap(live, 'pending', 'checks are still running', 'checks are still running'));
  gaps.push(...groupedPullGap(live, 'none', 'has no check results', 'have no check results'));
  return gaps;
}

/** One line per check state, so four old PRs do not produce four warnings. */
function groupedPullGap(pulls: PullEvidence[], state: ChecksState, one: string, many: string): string[] {
  const matching = pulls.filter((pull) => pull.checks === state).map((pull) => `#${pull.number}`);
  if (matching.length === 0) return [];
  return matching.length === 1 ? [`PR ${matching[0]} ${one}`] : [`PRs ${matching.join(', ')} ${many}`];
}

export function describePull(pull: PullEvidence): string {
  const checks = pull.checks === 'none' ? 'no checks' : `checks ${pull.checks}`;
  const link = pull.link === 'closes' ? 'closes Issue' : 'mentions Issue';
  return `PR #${pull.number} ${pull.state} · ${checks} · ${link}`;
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
