import { parseArtifact } from './parse';
import { Artifact, ValidationIssue, WorkspaceResult } from './types';

export interface SourceFile {
  path: string;
  text: string;
}

/** Cross-artifact rules: unique IDs, resolvable requirement references, single task owner. */
export function validateWorkspace(artifacts: Artifact[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (a: Artifact, code: string, message: string) =>
    issues.push({ severity: 'error', code, message, path: a.path });

  const byId = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    const first = byId.get(artifact.id);
    if (first) add(artifact, 'duplicate-id', `${artifact.id} is already defined in ${first.path}.`);
    else byId.set(artifact.id, artifact);
  }

  const taskOwner = new Map<string, string>();
  for (const artifact of artifacts) {
    if (artifact.kind === 'task') {
      const target = byId.get(artifact.requirement);
      if (!target || target.kind !== 'requirement') {
        add(artifact, 'unknown-requirement', `${artifact.id} refers to ${artifact.requirement}, which does not exist.`);
      }
    } else {
      for (const task of artifact.tasks) {
        const owner = taskOwner.get(task.id);
        if (owner && owner !== artifact.id) {
          add(artifact, 'task-listed-twice', `${task.id} is already listed under ${owner}.`);
        } else {
          taskOwner.set(task.id, artifact.id);
        }
      }
    }
  }
  return issues;
}

export function loadWorkspace(files: SourceFile[]): WorkspaceResult {
  const artifacts: Artifact[] = [];
  const issues: ValidationIssue[] = [];
  for (const file of files) {
    const result = parseArtifact(file.path, file.text);
    issues.push(...result.issues);
    if (result.artifact) artifacts.push(result.artifact);
  }
  issues.push(...validateWorkspace(artifacts));
  return { artifacts, issues };
}
