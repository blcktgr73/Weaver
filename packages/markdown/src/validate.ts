import type { MessageArgs } from './i18n';
import { parseArtifact } from './parse';
import { Artifact, ValidationIssue, WorkspaceResult } from './types';

export interface SourceFile {
  path: string;
  text: string;
}

/** Cross-artifact rules: unique IDs, resolvable requirement references, single task owner. */
export function validateWorkspace(artifacts: Artifact[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (a: Artifact, code: string, args: MessageArgs, severity: 'error' | 'warning' = 'error') =>
    issues.push({ severity, code, args, path: a.path });

  const byId = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    const first = byId.get(artifact.id);
    if (first) add(artifact, 'duplicate-id', { id: artifact.id, path: first.path });
    else byId.set(artifact.id, artifact);
  }

  const taskOwner = new Map<string, string>();
  for (const artifact of artifacts) {
    if (artifact.kind === 'task') {
      const target = byId.get(artifact.requirement);
      if (!target || target.kind !== 'requirement') {
        add(artifact, 'unknown-requirement', { task: artifact.id, requirement: artifact.requirement });
      } else {
        if (!target.tasks.some((task) => task.id === artifact.id)) {
          add(artifact, 'task-not-listed', { task: artifact.id, requirement: target.id }, 'warning');
        }
        for (const criterion of artifact.criteria) {
          if (!target.criteria.some((c) => c.id === criterion)) {
            add(artifact, 'unknown-criterion', { task: artifact.id, criterion, requirement: target.id }, 'warning');
          }
        }
      }
    } else {
      for (const task of artifact.tasks) {
        const owner = taskOwner.get(task.id);
        if (owner && owner !== artifact.id) {
          add(artifact, 'task-listed-twice', { task: task.id, owner });
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
