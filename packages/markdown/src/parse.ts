import { parse as parseYaml } from 'yaml';
import { parseCriteria, parseTasks } from './body';
import {
  ASSIGNEE_TYPES,
  AssigneeType,
  LIFECYCLE_STATUSES,
  LifecycleStatus,
  ParseResult,
  RequirementArtifact,
  TaskArtifact,
  ValidationIssue,
} from './types';

const FRONTMATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const TYPE_HINT = /^type:\s*["']?(requirement|task)["']?\s*$/m;

const PATTERNS = {
  requirement: /^REQ-\d{3,}$/,
  task: /^TASK-\d{3,}$/,
  story: /^US-\d{3,}$/,
  repository: /^[\w.-]+\/[\w.-]+$/,
};

const KNOWN_REQUIREMENT_FIELDS = [
  'id', 'type', 'title', 'status', 'owner', 'story_ids', 'repository', 'github_project',
];
const KNOWN_TASK_FIELDS = [
  'id', 'type', 'title', 'requirement', 'status', 'assignee_type', 'assignee', 'repository',
  'branch', 'pull_request', 'issue', 'tests', 'blockers',
];

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function parseArtifact(path: string, text: string): ParseResult {
  const match = FRONTMATTER.exec(text);
  if (!match) return { isArtifact: false, issues: [] };

  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], code: string, message: string) =>
    issues.push({ severity, code, message, path });

  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    if (!TYPE_HINT.test(match[1])) return { isArtifact: false, issues: [] };
    add('error', 'frontmatter-invalid', `Frontmatter is not valid YAML: ${(error as Error).message}`);
    return { isArtifact: true, issues };
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { isArtifact: false, issues: [] };
  }
  const fm = data as Record<string, unknown>;
  const type = fm.type;
  if (type !== 'requirement' && type !== 'task') {
    return { isArtifact: false, issues: [] };
  }

  const body = text.slice(match[0].length);
  const required = (field: string): string | undefined => {
    const value = str(fm[field]);
    if (!value) add('error', 'missing-field', `Required field "${field}" is missing or empty.`);
    return value;
  };

  const id = required('id');
  if (id && !PATTERNS[type].test(id)) {
    add('error', 'invalid-id', `"${id}" does not match the ${type === 'requirement' ? 'REQ-###' : 'TASK-###'} pattern.`);
  }
  const title = required('title');
  const statusRaw = required('status');
  if (statusRaw && !(LIFECYCLE_STATUSES as readonly string[]).includes(statusRaw)) {
    add('error', 'invalid-status', `Status "${statusRaw}" is not allowed. Use one of: ${LIFECYCLE_STATUSES.join(', ')}.`);
  }
  const repository = str(fm.repository);
  if (repository && !PATTERNS.repository.test(repository)) {
    add('error', 'invalid-repository', `Repository "${repository}" must look like owner/name.`);
  }

  const known = type === 'requirement' ? KNOWN_REQUIREMENT_FIELDS : KNOWN_TASK_FIELDS;
  for (const key of Object.keys(fm)) {
    if (!known.includes(key)) add('warning', 'unknown-field', `Unknown field "${key}" is kept but not interpreted.`);
  }

  const status = statusRaw as LifecycleStatus;

  if (type === 'requirement') {
    const rawStories = fm.story_ids ?? [];
    const storyIds: string[] = [];
    if (!Array.isArray(rawStories)) {
      add('error', 'invalid-story-id', '"story_ids" must be a list.');
    } else {
      for (const story of rawStories) {
        if (typeof story === 'string' && PATTERNS.story.test(story)) storyIds.push(story);
        else add('error', 'invalid-story-id', `Story ID "${String(story)}" does not match US-###.`);
      }
    }

    const criteria = parseCriteria(body);
    const { tasks, malformed } = parseTasks(body);
    if (criteria.length === 0) add('warning', 'no-acceptance-criteria', 'No items under "## Acceptance criteria".');
    if (tasks.length === 0) add('warning', 'no-tasks', 'No items under "## Tasks".');
    for (const item of malformed) {
      add('warning', 'malformed-task-item', `Task list item does not start with a TASK ID: "${item}"`);
    }
    for (const task of tasks) {
      if (!task.issueUrl) add('warning', 'task-without-issue', `${task.id} has no Issue link.`);
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    if (hasErrors || !id || !title || !statusRaw) return { isArtifact: true, issues };
    const artifact: RequirementArtifact = {
      kind: 'requirement',
      path, id, title, status, storyIds, criteria, tasks,
      ...(str(fm.owner) ? { owner: str(fm.owner) } : {}),
      ...(repository ? { repository } : {}),
      ...(str(fm.github_project) ? { githubProject: str(fm.github_project) } : {}),
      frontmatter: fm,
    };
    return { isArtifact: true, artifact, issues };
  }

  const requirement = required('requirement');
  if (requirement && !PATTERNS.requirement.test(requirement)) {
    add('error', 'invalid-requirement-ref', `Requirement reference "${requirement}" does not match REQ-###.`);
  }
  const assigneeType = str(fm.assignee_type);
  if (assigneeType && !(ASSIGNEE_TYPES as readonly string[]).includes(assigneeType)) {
    add('error', 'invalid-assignee-type', `assignee_type "${assigneeType}" must be human or agent.`);
  }
  const blockers = Array.isArray(fm.blockers) ? fm.blockers.map(String) : [];
  if (fm.blockers !== undefined && !Array.isArray(fm.blockers)) {
    add('error', 'invalid-blockers', '"blockers" must be a list.');
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors || !id || !title || !statusRaw || !requirement) return { isArtifact: true, issues };
  const pullRequest = fm.pull_request === null ? null : str(fm.pull_request);
  const artifact: TaskArtifact = {
    kind: 'task',
    path, id, title, requirement, status, blockers,
    ...(assigneeType ? { assigneeType: assigneeType as AssigneeType } : {}),
    ...(str(fm.assignee) ? { assignee: str(fm.assignee) } : {}),
    ...(repository ? { repository } : {}),
    ...(str(fm.branch) ? { branch: str(fm.branch) } : {}),
    ...(pullRequest !== undefined ? { pullRequest } : {}),
    ...(str(fm.issue) ? { issue: str(fm.issue) } : {}),
    ...(str(fm.tests) ? { tests: str(fm.tests) } : {}),
    frontmatter: fm,
  };
  return { isArtifact: true, artifact, issues };
}
