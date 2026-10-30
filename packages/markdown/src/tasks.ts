import { Notice } from './i18n';
import { KanbanColumn } from './kanban';
import { Artifact, AssigneeType, RequirementArtifact, TaskArtifact, TaskRef } from './types';

/** A task from a requirement's list, joined with its task file when there is one (DEC-005). */
export interface MergedTask extends TaskRef {
  file?: TaskArtifact;
}

/** Joins the requirement's task list with task files by ID. The list decides order and title. */
export function mergeTasks(requirement: RequirementArtifact, artifacts: Artifact[]): MergedTask[] {
  const files = new Map<string, TaskArtifact>();
  for (const artifact of artifacts) {
    if (artifact.kind === 'task' && artifact.requirement === requirement.id) files.set(artifact.id, artifact);
  }
  return requirement.tasks.map((task) => {
    const file = files.get(task.id);
    if (!file) return task;
    const issueUrl = task.issueUrl ?? file.issue;
    const issueNumber = task.issueNumber ?? (issueUrl ? Number(/\/issues\/(\d+)/.exec(issueUrl)?.[1]) || undefined : undefined);
    return { ...task, ...(issueUrl ? { issueUrl } : {}), ...(issueNumber ? { issueNumber } : {}), file };
  });
}

export interface Owner {
  name: string;
  type?: AssigneeType;
  /** `file` is recorded in the repository; `issue` is only the GitHub assignee. */
  source: 'file' | 'issue';
}

/** The task file's owner wins. The Issue assignee is a fallback hint (DEC-005). */
export function ownerOf(task: MergedTask, issueAssignees: readonly string[] = []): Owner | undefined {
  const name = task.file?.assignee;
  if (name) return { name, ...(task.file?.assigneeType ? { type: task.file.assigneeType } : {}), source: 'file' };
  if (issueAssignees.length > 0) return { name: issueAssignees.join(', '), source: 'issue' };
  return undefined;
}

/** A task past the backlog needs an owner. */
export function ownerGaps(column: KanbanColumn, owner: Owner | undefined): Notice[] {
  return column !== 'Backlog' && !owner ? [{ code: 'gap.no-owner' }] : [];
}
