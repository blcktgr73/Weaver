import type { Notice } from './i18n';
import type { KanbanColumn } from './kanban';

/** Columns where work is going on. A Backlog card may wait for a long time without being stale. */
const ACTIVE: readonly KanbanColumn[] = ['Ready', 'In progress', 'Blocked', 'Review'];
const EVIDENCE_COLUMNS: readonly KanbanColumn[] = ['Review', 'Verified'];

export const DEFAULT_STALE_DAYS = 14;

export interface StaleInput {
  column: KanbanColumn;
  /** A closed Issue is finished work, so it is never idle. Left out, the Issue is taken as open. */
  state?: 'open' | 'closed';
  /** When the Issue last changed, as an ISO date. */
  updatedAt?: string;
  /** Pull requests that close or mention the Issue. Leave out when it was not read. */
  pullCount?: number;
  /** The task file asks for a human decision (`status: needs-human-decision`). */
  needsDecision?: boolean;
  /** The task has a human-approved evidence exception (DEC-006). */
  evidenceException?: boolean;
}

/**
 * Why a card needs a second look, one notice per reason so the card can show them apart:
 * idle for `idleDays` or more in an active column, in Review or Verified without any pull
 * request, or waiting for a human decision.
 */
export function staleNotices(input: StaleInput, now: Date, idleDays: number = DEFAULT_STALE_DAYS): Notice[] {
  const notices: Notice[] = [];

  if (ACTIVE.includes(input.column) && input.state !== 'closed' && input.updatedAt) {
    const changed = Date.parse(input.updatedAt);
    if (!Number.isNaN(changed)) {
      const days = Math.floor((now.getTime() - changed) / 86_400_000);
      if (days >= Math.max(1, idleDays)) notices.push({ code: 'stale.idle', args: { days, count: days } });
    }
  }

  if (EVIDENCE_COLUMNS.includes(input.column) && input.pullCount === 0 && !input.evidenceException) {
    notices.push({ code: 'stale.no-evidence' });
  }

  if (input.needsDecision && input.column !== 'Verified') notices.push({ code: 'stale.needs-decision' });
  return notices;
}
