import { parse as parseYaml } from 'yaml';
import { parseCriteria, parseTasks } from './body';
import type { MessageArgs } from './i18n';
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
  const add = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) =>
    issues.push({ severity, code, ...(args ? { args } : {}), path });

  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    if (!TYPE_HINT.test(match[1])) return { isArtifact: false, issues: [] };
    add('error', 'frontmatter-invalid', { detail: (error as Error).message });
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
    if (!value) add('error', 'missing-field', { field });
    return value;
  };

  const id = required('id');
  if (id && !PATTERNS[type].test(id)) {
    add('error', 'invalid-id', { id, pattern: type === 'requirement' ? 'REQ-###' : 'TASK-###' });
  }
  const title = required('title');
  const statusRaw = required('status');
  if (statusRaw && !(LIFECYCLE_STATUSES as readonly string[]).includes(statusRaw)) {
    add('error', 'invalid-status', { status: statusRaw, allowed: LIFECYCLE_STATUSES.join(', ') });
  }
  const repository = str(fm.repository);
  if (repository && !PATTERNS.repository.test(repository)) {
    add('error', 'invalid-repository', { repository });
  }

  const known = type === 'requirement' ? KNOWN_REQUIREMENT_FIELDS : KNOWN_TASK_FIELDS;
  for (const key of Object.keys(fm)) {
    if (!known.includes(key)) add('warning', 'unknown-field', { field: key });
  }

  const status = statusRaw as LifecycleStatus;

  if (type === 'requirement') {
    const rawStories = fm.story_ids ?? [];
    const storyIds: string[] = [];
    if (!Array.isArray(rawStories)) {
      add('error', 'story-ids-not-list');
    } else {
      for (const story of rawStories) {
        if (typeof story === 'string' && PATTERNS.story.test(story)) storyIds.push(story);
        else add('error', 'invalid-story-id', { id: String(story) });
      }
    }

    const criteria = parseCriteria(body);
    const { tasks, malformed } = parseTasks(body);
    if (criteria.length === 0) add('warning', 'no-acceptance-criteria');
    if (tasks.length === 0) add('warning', 'no-tasks');
    for (const item of malformed) {
      add('warning', 'malformed-task-item', { item });
    }
    for (const task of tasks) {
      if (!task.issueUrl) add('warning', 'task-without-issue', { task: task.id });
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
    add('error', 'invalid-requirement-ref', { requirement });
  }
  const assigneeType = str(fm.assignee_type);
  if (assigneeType && !(ASSIGNEE_TYPES as readonly string[]).includes(assigneeType)) {
    add('error', 'invalid-assignee-type', { value: assigneeType });
  }
  const blockers = Array.isArray(fm.blockers) ? fm.blockers.map(String) : [];
  if (fm.blockers !== undefined && !Array.isArray(fm.blockers)) {
    add('error', 'invalid-blockers');
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
