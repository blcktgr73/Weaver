export const LIFECYCLE_STATUSES = [
  'draft',
  'ready',
  'assigned',
  'in-progress',
  'review',
  'verified',
  'accepted',
  'blocked',
  'needs-human-decision',
  'cancelled',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const ASSIGNEE_TYPES = ['human', 'agent'] as const;
export type AssigneeType = (typeof ASSIGNEE_TYPES)[number];

import type { MessageArgs } from './i18n';

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  /** Short rule code. The message is looked up as `validation.<code>` in the catalog. */
  code: string;
  args?: MessageArgs;
  /** Workspace-relative path of the artifact the issue belongs to. */
  path: string;
}

export interface Criterion {
  id: string;
  text: string;
}

export interface TaskRef {
  id: string;
  title: string;
  issueUrl?: string;
  issueNumber?: number;
}

export interface RequirementArtifact {
  kind: 'requirement';
  path: string;
  id: string;
  title: string;
  status: LifecycleStatus;
  owner?: string;
  storyIds: string[];
  repository?: string;
  githubProject?: string;
  /** Who recorded acceptance and when (a human decision). */
  acceptedBy?: string;
  acceptedOn?: string;
  criteria: Criterion[];
  tasks: TaskRef[];
  frontmatter: Record<string, unknown>;
}

export interface TaskArtifact {
  kind: 'task';
  path: string;
  id: string;
  title: string;
  requirement: string;
  /** Optional when the task has an Issue link: the Issue is the source (DEC-005). */
  status?: LifecycleStatus;
  assigneeType?: AssigneeType;
  assignee?: string;
  repository?: string;
  branch?: string;
  pullRequest?: string | null;
  issue?: string;
  tests?: string;
  /** A human-approved reason to accept a task without complete evidence (DEC-006). */
  evidenceException?: string;
  /** Acceptance criteria IDs (`AC-001`) this task satisfies. */
  criteria: string[];
  blockers: string[];
  frontmatter: Record<string, unknown>;
}

export type Artifact = RequirementArtifact | TaskArtifact;

export interface ParseResult {
  /** False for ordinary Markdown that is not a Weaver artifact. */
  isArtifact: boolean;
  /** Present when the artifact is structurally usable, even if it has warnings. */
  artifact?: Artifact;
  issues: ValidationIssue[];
}

export interface WorkspaceResult {
  artifacts: Artifact[];
  issues: ValidationIssue[];
}
