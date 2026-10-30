import { Notice } from './i18n';
import { KanbanColumn } from './kanban';
import { Artifact, AssigneeType, Criterion, RequirementArtifact, TaskArtifact, TaskRef } from './types';

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

export type CriterionState =
  /** No task claims this criterion. */
  | 'uncovered'
  /** Tasks claim it, but their Issue status was not read yet. */
  | 'unknown'
  /** At least one claiming task is not Verified. */
  | 'in-progress'
  /** Every claiming task is Verified and has no evidence gaps. */
  | 'verified'
  /** Every claiming task is Verified, but some evidence is missing. */
  | 'verified-with-gaps';

export interface CriterionCoverage {
  criterion: Criterion;
  tasks: MergedTask[];
  state: CriterionState;
}

/** What the view knows about one task once its Issue and evidence were read. */
export interface TaskProgress {
  column: KanbanColumn;
  evidenceGapCount: number;
}

/** True when some task file names a criterion, so coverage can be judged at all. */
export function hasCriteriaMapping(tasks: MergedTask[]): boolean {
  return tasks.some((task) => (task.file?.criteria.length ?? 0) > 0);
}

/**
 * For each acceptance criterion: which tasks claim it, and how far their
 * evidence goes. It reports where evidence stands and never decides acceptance.
 */
export function criteriaCoverage(
  criteria: Criterion[],
  tasks: MergedTask[],
  progress: (taskId: string) => TaskProgress | undefined,
): CriterionCoverage[] {
  return criteria.map((criterion) => {
    const claiming = tasks.filter((task) => task.file?.criteria.includes(criterion.id));
    if (claiming.length === 0) return { criterion, tasks: claiming, state: 'uncovered' };
    const known = claiming.map((task) => progress(task.id));
    if (known.some((item) => item === undefined)) return { criterion, tasks: claiming, state: 'unknown' };
    const items = known as TaskProgress[];
    if (items.some((item) => item.column !== 'Verified')) return { criterion, tasks: claiming, state: 'in-progress' };
    const gaps = items.some((item) => item.evidenceGapCount > 0);
    return { criterion, tasks: claiming, state: gaps ? 'verified-with-gaps' : 'verified' };
  });
}

/** Criteria nobody claims. Empty until at least one task maps criteria. */
export function uncoveredCriteria(coverage: CriterionCoverage[], tasks: MergedTask[]): Criterion[] {
  if (!hasCriteriaMapping(tasks)) return [];
  return coverage.filter((item) => item.state === 'uncovered').map((item) => item.criterion);
}
