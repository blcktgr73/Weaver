import type { FabricRegistry } from './fabric';
import { KANBAN_COLUMNS, KanbanColumn, KanbanPlacement } from './kanban';
import type { Artifact } from './types';

export interface RequirementLink {
  id: string;
  title: string;
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
  const requirements = new Map<string, RequirementLink>();
  for (const artifact of artifacts) {
    if (artifact.kind !== 'requirement') continue;
    const link = { id: artifact.id, title: artifact.title };
    requirements.set(artifact.id, link);
    for (const task of artifact.tasks) {
      if (task.issueUrl) byIssue.set(normalizeIssueUrl(task.issueUrl), link);
    }
  }
  for (const artifact of artifacts) {
    if (artifact.kind !== 'task' || !artifact.issue) continue;
    const link = requirements.get(artifact.requirement);
    if (link) byIssue.set(normalizeIssueUrl(artifact.issue), link);
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
