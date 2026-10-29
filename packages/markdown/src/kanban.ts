export const KANBAN_COLUMNS = ['Backlog', 'Ready', 'In progress', 'Blocked', 'Review', 'Verified'] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

const LABEL_TO_COLUMN: Record<string, KanbanColumn> = {
  'status:backlog': 'Backlog',
  'status:ready': 'Ready',
  'status:in-progress': 'In progress',
  'status:blocked': 'Blocked',
  'status:review': 'Review',
  'status:verified': 'Verified',
};

export interface IssueSnapshot {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
}

export interface KanbanPlacement {
  column: KanbanColumn;
  /** Human-readable reasons the card needs attention. Empty when consistent. */
  gaps: string[];
}

/**
 * Projects a GitHub Issue onto a Kanban column.
 * See "Status mapping" in docs/product/requirements-v0.1.md.
 */
export function placeIssue(issue: Pick<IssueSnapshot, 'state' | 'labels'>): KanbanPlacement {
  const gaps: string[] = [];
  const found = KANBAN_COLUMNS.filter((column) =>
    issue.labels.some((label) => LABEL_TO_COLUMN[label] === column),
  );

  if (found.length > 1) gaps.push(`multiple status labels: ${found.join(', ')}`);
  let column: KanbanColumn = found[0] ?? 'Backlog';
  if (found.length === 0) gaps.push('no status label');

  if (issue.state === 'closed' && column !== 'Verified') {
    gaps.push('closed without status:verified (verification gap)');
    column = 'Review';
  }
  if (issue.state === 'open' && column === 'Verified') {
    gaps.push('open but labeled status:verified');
  }
  return { column, gaps };
}

export function groupByColumn<T extends { placement: KanbanPlacement }>(
  cards: T[],
): Record<KanbanColumn, T[]> {
  const grouped = Object.fromEntries(KANBAN_COLUMNS.map((c) => [c, [] as T[]])) as Record<KanbanColumn, T[]>;
  for (const card of cards) grouped[card.placement.column].push(card);
  return grouped;
}

/** Extracts owner, repo, and number from a GitHub Issue URL. */
export function parseIssueUrl(url: string): { owner: string; repo: string; number: number } | undefined {
  const match = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\/?$/.exec(url);
  return match ? { owner: match[1], repo: match[2], number: Number(match[3]) } : undefined;
}
