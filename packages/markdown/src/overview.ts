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
