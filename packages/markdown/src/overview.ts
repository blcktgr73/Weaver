import type { FabricRegistry } from './fabric';
import { KANBAN_COLUMNS, KanbanColumn, KanbanPlacement } from './kanban';
import type { Artifact } from './types';

export interface RequirementLink {
  id: string;
  title: string;
  /** Workspace-relative path of the requirement file. */
  path: string;
  /** The task this Issue stands for, so a view can scroll to it. */
  taskId: string;
  /** Workspace-relative path of the task file, when the task has one. */
  taskPath?: string;
}

/** Issue URLs compare without case and without a trailing slash. */
export function normalizeIssueUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Which requirement each Issue belongs to, read from the files in the workspace:
 * a requirement's `## Tasks` list and the `issue` field of its task files.
 * Issues of repositories that are not cloned here have no entry.
 */
export function requirementsByIssue(artifacts: readonly Artifact[]): Map<string, RequirementLink> {
  const byIssue = new Map<string, RequirementLink>();
  const requirements = new Map<string, Artifact & { kind: 'requirement' }>();
  for (const artifact of artifacts) {
    if (artifact.kind !== 'requirement') continue;
    requirements.set(artifact.id, artifact);
    for (const task of artifact.tasks) {
      if (task.issueUrl) {
        byIssue.set(normalizeIssueUrl(task.issueUrl), {
          id: artifact.id,
          title: artifact.title,
          path: artifact.path,
          taskId: task.id,
        });
      }
    }
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== 'task' || !artifact.issue) continue;
    const requirement = requirements.get(artifact.requirement);
    if (!requirement) continue;
    byIssue.set(normalizeIssueUrl(artifact.issue), {
      id: requirement.id,
      title: requirement.title,
      path: requirement.path,
      taskId: artifact.id,
      taskPath: artifact.path,
    });
  }
  return byIssue;
}

/** One row of the Overview: a registered repository with its cards split by column. */
export interface Lane<T> {
  repository: string;
  title: string;
  total: number;
  blocked: number;
  columns: Record<KanbanColumn, T[]>;
}

/**
 * Lanes are the registered repositories in registry order, so every registered
 * repository has a lane even when it has no cards. Cards of other repositories are ignored.
 * Within a column, cards are ordered by Issue number.
 */
export function buildLanes<T extends { repository: string; number: number; placement: KanbanPlacement }>(
  registry: FabricRegistry,
  cards: readonly T[],
): Lane<T>[] {
  return registry.repositories.map((entry) => {
    const columns = Object.fromEntries(KANBAN_COLUMNS.map((column) => [column, [] as T[]])) as Record<KanbanColumn, T[]>;
    let total = 0;
    for (const card of cards) {
      if (card.repository.toLowerCase() !== entry.repository.toLowerCase()) continue;
      columns[card.placement.column].push(card);
      total += 1;
    }
    for (const column of KANBAN_COLUMNS) columns[column].sort((a, b) => a.number - b.number);
    return {
      repository: entry.repository,
      title: entry.title ?? entry.repository.split('/')[1],
      total,
      blocked: columns.Blocked.length,
      columns,
    };
  });
}

/** True for a card that is finished work: in the Verified column, or with a closed Issue. A card with a gap is never counted as finished, so it stays in view. */
export function isFinished(card: { placement: KanbanPlacement; state?: 'open' | 'closed' }): boolean {
  return (card.placement.column === 'Verified' || card.state === 'closed') && card.placement.gaps.length === 0;
}

/**
 * The lane without its finished cards, and how many were taken out. The totals of the lane
 * stay as they were: a folded card is still counted, only not drawn.
 */
export function foldFinished<T extends { placement: KanbanPlacement; state?: 'open' | 'closed' }>(lane: Lane<T>): { lane: Lane<T>; folded: number } {
  let folded = 0;
  const columns = Object.fromEntries(
    KANBAN_COLUMNS.map((column) => {
      const kept = lane.columns[column].filter((card) => !isFinished(card));
      folded += lane.columns[column].length - kept.length;
      return [column, kept];
    }),
  ) as Record<KanbanColumn, T[]>;
  return { lane: { ...lane, columns }, folded };
}

/** What to show on the Overview: every card of a requirement, or the one card of a task. */
export interface FocusTarget {
  requirementId: string;
  taskId?: string;
}

/**
 * The cards of a requirement, or of one of its tasks, found through the Issue links of the
 * files in the workspace. The result keeps the order of `cards`.
 */
export function focusCards<T extends { url: string }>(
  cards: readonly T[],
  links: ReadonlyMap<string, RequirementLink>,
  target: FocusTarget,
): T[] {
  return cards.filter((card) => {
    const link = links.get(normalizeIssueUrl(card.url));
    return link !== undefined && link.id === target.requirementId && (target.taskId === undefined || link.taskId === target.taskId);
  });
}

/**
 * Puts lanes in the order the user chose. Lanes the user has not placed keep their registry
 * order after the placed ones, and names in `order` that are no longer registered are ignored.
 */
export function applyLaneOrder<T extends { repository: string }>(lanes: readonly T[], order: readonly string[]): T[] {
  const rank = new Map(order.map((name, index) => [name.toLowerCase(), index]));
  const placed = lanes.filter((lane) => rank.has(lane.repository.toLowerCase()));
  const rest = lanes.filter((lane) => !rank.has(lane.repository.toLowerCase()));
  placed.sort((a, b) => (rank.get(a.repository.toLowerCase()) as number) - (rank.get(b.repository.toLowerCase()) as number));
  return [...placed, ...rest];
}

/**
 * Moves one lane a step up (-1) or down (1) among the lanes that are shown, by swapping it with
 * its neighbor in the full order, so a hidden lane in between never makes a move do nothing.
 * Returns the new full order; it is unchanged when the lane is already at that end.
 */
export function moveLane(fullOrder: readonly string[], shown: readonly string[], repository: string, delta: -1 | 1): string[] {
  const next = [...fullOrder];
  const at = shown.indexOf(repository);
  const neighbor = at < 0 ? undefined : shown[at + delta];
  if (neighbor === undefined) return next;
  const a = next.indexOf(repository);
  const b = next.indexOf(neighbor);
  if (a < 0 || b < 0) return next;
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
