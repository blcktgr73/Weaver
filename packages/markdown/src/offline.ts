import type { FabricRegistry } from './fabric';
import type { KanbanColumn } from './kanban';
import type { RequirementLink } from './overview';
import { mergeTasks } from './tasks';
import type { Artifact, LifecycleStatus } from './types';

/**
 * The column a task file's status folds into (the status mapping table in the product
 * requirements). `cancelled` has no column; a task whose file gives no status is shown in Backlog.
 */
export function columnOfStatus(status: LifecycleStatus | undefined): KanbanColumn | undefined {
  switch (status) {
    case undefined:
    case 'draft':
      return 'Backlog';
    case 'ready':
    case 'assigned':
      return 'Ready';
    case 'in-progress':
      return 'In progress';
    case 'blocked':
    case 'needs-human-decision':
      return 'Blocked';
    case 'review':
      return 'Review';
    case 'verified':
    case 'accepted':
      return 'Verified';
    case 'cancelled':
      return undefined;
  }
}

/** A card built from the repository files alone, for when GitHub cannot be read. */
export interface OfflineCard {
  /** `owner/name`, as the registry writes it. */
  repository: string;
  taskId: string;
  title: string;
  column: KanbanColumn;
  issueNumber?: number;
  issueUrl?: string;
  requirement: RequirementLink;
  /** The task file gave no status, so the card sits in Backlog without knowing better. */
  statusUnknown: boolean;
}

/**
 * Cards for every task of the requirements in the workspace whose repository is registered.
 * The state comes from the task file, which can be older than the Issue, so a caller must
 * say that it is not current.
 */
export function offlineCards(artifacts: readonly Artifact[], registry: FabricRegistry): OfflineCard[] {
  const registered = new Map(registry.repositories.map((r) => [r.repository.toLowerCase(), r.repository]));
  const cards: OfflineCard[] = [];
  for (const requirement of artifacts) {
    if (requirement.kind !== 'requirement') continue;
    for (const task of mergeTasks(requirement, artifacts as Artifact[])) {
      const repository = registered.get((task.file?.repository ?? requirement.repository ?? '').toLowerCase());
      if (!repository) continue;
      const column = columnOfStatus(task.file?.status);
      if (!column) continue;
      cards.push({
        repository,
        taskId: task.id,
        title: task.title,
        column,
        ...(task.issueNumber ? { issueNumber: task.issueNumber } : {}),
        ...(task.issueUrl ? { issueUrl: task.issueUrl } : {}),
        requirement: {
          id: requirement.id,
          title: requirement.title,
          path: requirement.path,
          taskId: task.id,
          ...(task.file ? { taskPath: task.file.path } : {}),
        },
        statusUnknown: task.file?.status === undefined,
      });
    }
  }
  return cards;
}
