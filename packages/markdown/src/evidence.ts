import { KanbanColumn } from './kanban';

export type ChecksState = 'passing' | 'failing' | 'pending' | 'none';

export interface PullEvidence {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
  checks: ChecksState;
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
  for (const pull of evidence.pulls) {
    if (pull.state === 'closed') continue; // closed without merge is not evidence either way
    if (pull.checks === 'failing') gaps.push(`PR #${pull.number} has failing checks`);
    else if (pull.checks === 'pending') gaps.push(`PR #${pull.number} checks are still running`);
    else if (pull.checks === 'none') gaps.push(`PR #${pull.number} has no check results`);
  }
  return gaps;
}

export function describePull(pull: PullEvidence): string {
  const checks = pull.checks === 'none' ? 'no checks' : `checks ${pull.checks}`;
  return `PR #${pull.number} ${pull.state} · ${checks}`;
}
