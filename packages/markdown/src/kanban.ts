import type { Notice } from './i18n';

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
  /** Reasons the card needs attention. Empty when consistent. */
  gaps: Notice[];
}

/**
 * Projects a GitHub Issue onto a Kanban column.
 * See "Status mapping" in docs/product/requirements-v0.1.md.
 */
export function placeIssue(issue: Pick<IssueSnapshot, 'state' | 'labels'>): KanbanPlacement {
  const gaps: Notice[] = [];
  const found = KANBAN_COLUMNS.filter((column) =>
    issue.labels.some((label) => LABEL_TO_COLUMN[label] === column),
  );

  if (found.length > 1) gaps.push({ code: 'gap.multiple-status-labels', args: { columns: found } });
  let column: KanbanColumn = found[0] ?? 'Backlog';
  if (found.length === 0) gaps.push({ code: 'gap.no-status-label' });

  if (issue.state === 'closed' && column !== 'Verified') {
    gaps.push({ code: 'gap.closed-without-verified' });
    column = 'Review';
  }
  if (issue.state === 'open' && column === 'Verified') {
    gaps.push({ code: 'gap.open-but-verified' });
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

export type ProjectStatus = 'Todo' | 'In Progress' | 'Done';

/** The shared board Status is derived from the column (DEC-003). */
export const PROJECT_STATUS_FOR_COLUMN: Record<KanbanColumn, ProjectStatus> = {
  Backlog: 'Todo',
  Ready: 'Todo',
  'In progress': 'In Progress',
  Blocked: 'In Progress',
  Review: 'In Progress',
  Verified: 'Done',
};

export const LABEL_FOR_COLUMN = Object.fromEntries(
  Object.entries(LABEL_TO_COLUMN).map(([label, column]) => [column, label]),
) as Record<KanbanColumn, string>;

/** The `Status` of an Issue on one GitHub project board, as read from GitHub. */
export interface BoardItem {
  project: string;
  status: string;
}

/**
 * The board Status is derived from the label (DEC-003). A person can change it
 * by hand on the board, so report items that no longer match. When `project`
 * is given, only that board counts.
 */
export function boardGaps(column: KanbanColumn, items: BoardItem[] | undefined, project?: string): Notice[] {
  if (!items) return [];
  const expected = PROJECT_STATUS_FOR_COLUMN[column];
  return items
    .filter((item) => !project || item.project === project)
    .filter((item) => item.status !== expected)
    .map((item) => ({ code: 'gap.board-status-differs' as const, args: { board: item.project, actual: item.status, expected } }));
}

export interface MovePlan {
  column: KanbanColumn;
  addLabel: string;
  /** Existing status labels that differ from the target. */
  removeLabels: string[];
  state: 'open' | 'closed';
  projectStatus: ProjectStatus;
  /** True when the Issue already matches the target; nothing to write. */
  noop: boolean;
}

/** Computes every GitHub change needed to place an Issue in `target`. */
export function planMove(issue: Pick<IssueSnapshot, 'state' | 'labels'>, target: KanbanColumn): MovePlan {
  const addLabel = LABEL_FOR_COLUMN[target];
  const removeLabels = issue.labels.filter((label) => label in LABEL_TO_COLUMN && label !== addLabel);
  const state = target === 'Verified' ? 'closed' : 'open';
  const noop = removeLabels.length === 0 && issue.labels.includes(addLabel) && issue.state === state;
  return { column: target, addLabel, removeLabels, state, projectStatus: PROJECT_STATUS_FOR_COLUMN[target], noop };
}

/** What a move will change, one notice per line, for the confirmation dialog. */
export function describeMove(plan: MovePlan, issue: Pick<IssueSnapshot, 'state' | 'labels'>): Notice[] {
  const lines: Notice[] = [];
  if (plan.removeLabels.length) {
    lines.push({ code: 'move.remove-labels', args: { labels: plan.removeLabels, count: plan.removeLabels.length } });
  }
  if (!issue.labels.includes(plan.addLabel)) lines.push({ code: 'move.add-label', args: { label: plan.addLabel } });
  if (issue.state !== plan.state) lines.push({ code: plan.state === 'closed' ? 'move.close-issue' : 'move.reopen-issue' });
  lines.push({ code: 'move.set-board-status', args: { status: plan.projectStatus } });
  return lines;
}
