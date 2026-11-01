import {
  CriterionCoverage,
  criteriaCoverage,
  evidenceGaps,
  honoredException,
  MergedTask,
  placeIssue,
  RequirementArtifact,
} from '@palab/weaver-markdown';
import type { StatusState } from './requirementHtml';

/** Per-criterion coverage from what the view has read so far. Shared by the page and the acceptance dialog. */
export function coverageOf(
  requirement: RequirementArtifact,
  tasks: MergedTask[],
  status: StatusState | undefined,
): CriterionCoverage[] {
  return criteriaCoverage(requirement.criteria, tasks, (taskId) => {
    const result = status?.byTask[taskId];
    if (!result?.ok) return undefined;
    const column = placeIssue({ ...result.issue, boardStatus: result.boardStatus }, result.rules).column;
    const excepted = honoredException(tasks.find((task) => task.id === taskId)?.file?.evidenceException, result.evidenceRules);
    const gaps = excepted ? 0 : result.evidenceError ? 1 : evidenceGaps(column, result.evidence, result.evidenceRules).length;
    return { column, evidenceGapCount: gaps };
  });
}
