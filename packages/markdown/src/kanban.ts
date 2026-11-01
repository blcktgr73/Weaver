import type { Notice } from './i18n';
import type { ProcessConfig } from './process';

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

/** How a repository decides a card's column (DEC-015). Without a process file these are today's defaults. */
export type ColumnRules = ProcessConfig['columns'];

/**
 * Projects a GitHub Issue onto a Kanban column.
 * See "Status mapping" in docs/product/requirements-v0.1.md. The column comes from the status
 * labels, or from the board Status when the repository's process says so.
 */
export function placeIssue(issue: Pick<IssueSnapshot, 'state' | 'labels'> & { boardStatus?: string }, rules: ColumnRules = defaultRules()): KanbanPlacement {
  const gaps: Notice[] = [];
  let column: KanbanColumn;

  if (rules.source === 'board-status') {
    const mapped = issue.boardStatus === undefined ? undefined : rules.board[issue.boardStatus];
    column = mapped ?? 'Backlog';
    if (!mapped) gaps.push(issue.boardStatus === undefined ? { code: 'gap.no-board-status' } : { code: 'gap.unmapped-board-status', args: { status: issue.boardStatus } });
  } else {
    const found = KANBAN_COLUMNS.filter((c) => issue.labels.includes(rules.labels[c]));
    if (found.length > 1) gaps.push({ code: 'gap.multiple-status-labels', args: { columns: found } });
    column = found[0] ?? 'Backlog';
    if (found.length === 0) gaps.push({ code: 'gap.no-status-label' });
  }

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

/** Today's behavior as rules: the status labels decide, and the board follows (DEC-003). */
function defaultRules(): ColumnRules {
  return { source: 'labels', labels: LABEL_FOR_COLUMN, board: { Todo: 'Backlog', 'In Progress': 'In progress', Done: 'Verified' } };
}

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
export function boardGaps(column: KanbanColumn, items: BoardItem[] | undefined, project?: string, rules?: ColumnRules): Notice[] {
  // When the board is the source of the column, there is nothing for it to differ from.
  if (!items || rules?.source === 'board-status') return [];
  const expected = PROJECT_STATUS_FOR_COLUMN[column];
  return items
    .filter((item) => !project || item.project === project)
    .filter((item) => item.status !== expected)
    .map((item) => ({ code: 'gap.board-status-differs' as const, args: { board: item.project, actual: item.status, expected } }));
}

export interface MovePlan {
  column: KanbanColumn;
  /** The status label to add. None when the board Status is the source of the column. */
  addLabel?: string;
  /** Existing status labels that differ from the target. */
  removeLabels: string[];
  state: 'open' | 'closed';
  /** The board Status to set. None when the board has no option that means the target column. */
  projectStatus?: string;
  /** The repository's board cannot show the target column, so the move cannot be done there. */
  unavailable?: true;
  /** True when the Issue already matches the target; nothing to write. */
  noop: boolean;
}

/** Computes every GitHub change needed to place an Issue in `target`. */
export function planMove(issue: Pick<IssueSnapshot, 'state' | 'labels'> & { boardStatus?: string }, target: KanbanColumn, rules: ColumnRules = defaultRules()): MovePlan {
  const state = target === 'Verified' ? 'closed' : 'open';

  if (rules.source === 'board-status') {
    // The board option that means the target. A board with three options cannot show Ready, Blocked, or Review.
    const projectStatus = Object.keys(rules.board).find((status) => rules.board[status] === target);
    if (projectStatus === undefined) return { column: target, removeLabels: [], state, unavailable: true, noop: false };
    return { column: target, removeLabels: [], state, projectStatus, noop: issue.state === state && issue.boardStatus === projectStatus };
  }

  const addLabel = rules.labels[target];
  const statusLabels = new Set(Object.values(rules.labels));
  const removeLabels = issue.labels.filter((label) => statusLabels.has(label) && label !== addLabel);
  const noop = removeLabels.length === 0 && issue.labels.includes(addLabel) && issue.state === state;
  return { column: target, addLabel, removeLabels, state, projectStatus: PROJECT_STATUS_FOR_COLUMN[target], noop };
}

/** What a move will change, one notice per line, for the confirmation dialog. */
export function describeMove(plan: MovePlan, issue: Pick<IssueSnapshot, 'state' | 'labels'>): Notice[] {
  const lines: Notice[] = [];
  if (plan.removeLabels.length) {
    lines.push({ code: 'move.remove-labels', args: { labels: plan.removeLabels, count: plan.removeLabels.length } });
  }
  if (plan.addLabel && !issue.labels.includes(plan.addLabel)) lines.push({ code: 'move.add-label', args: { label: plan.addLabel } });
  if (issue.state !== plan.state) lines.push({ code: plan.state === 'closed' ? 'move.close-issue' : 'move.reopen-issue' });
  if (plan.projectStatus) lines.push({ code: 'move.set-board-status', args: { status: plan.projectStatus } });
  return lines;
}
