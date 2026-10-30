import type { Artifact, RequirementArtifact } from './types';

/** What a Markdown file is to Weaver. `none` is ordinary Markdown. */
export type DocumentKind = 'requirement' | 'task' | 'none';

/** The kind of Weaver document at a workspace-relative path, from the parsed artifacts. */
export function documentKindOf(artifacts: Artifact[], path: string): DocumentKind {
  return artifacts.find((artifact) => artifact.path === path)?.kind ?? 'none';
}

export interface ViewTarget {
  requirement: RequirementArtifact;
  /** Set when the file was a task file: the view scrolls to this task. */
  taskId?: string;
}

/**
 * The requirement view a Weaver document opens: a requirement file opens itself,
 * a task file opens the requirement it belongs to, focused on that task.
 * Undefined for ordinary Markdown and for a task whose requirement does not exist.
 */
export function viewTargetOf(artifacts: Artifact[], path: string): ViewTarget | undefined {
  const artifact = artifacts.find((a) => a.path === path);
  if (artifact?.kind === 'requirement') return { requirement: artifact };
  if (artifact?.kind === 'task') {
    const requirement = artifacts.find((a): a is RequirementArtifact => a.kind === 'requirement' && a.id === artifact.requirement);
    return requirement && { requirement, taskId: artifact.id };
  }
  return undefined;
}
