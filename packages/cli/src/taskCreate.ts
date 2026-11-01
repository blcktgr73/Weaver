import * as path from 'path';
import { Artifact, Locale, RequirementArtifact } from '@palab/weaver-markdown';
import { addIssueToProject, createIssue, NoticeError, type Fetch } from '@palab/weaver-github';
import { attribution, PlannedAction } from './actions';
import type { System } from './contract';
import { openFilesPullRequest } from './filesPullRequest';

export const taskIdOf = (number: number): string => `TASK-${String(number).padStart(3, '0')}`;

/** The next free task number: one more than the largest `TASK-###` in any of the given texts. */
export function nextTaskNumber(sources: Iterable<string>): number {
  let largest = 0;
  for (const text of sources) for (const match of text.matchAll(/task-(\d{3,})/gi)) largest = Math.max(largest, Number(match[1]));
  return largest + 1;
}

export function slugOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '') || 'task';
}

export interface TaskFileInput {
  id: string;
  title: string;
  requirement: string;
  issueUrl: string;
  issueNumber: number;
  repository: string;
  criteria: string[];
  assigneeType: 'human' | 'agent';
  assignee?: string;
}

export function renderTaskFile(input: TaskFileInput): string {
  const front = [
    '---',
    `id: ${input.id}`,
    'type: task',
    `title: ${input.title}`,
    `requirement: ${input.requirement}`,
    `issue: ${input.issueUrl}`,
    `repository: ${input.repository}`,
    `assignee_type: ${input.assigneeType}`,
    ...(input.criteria.length ? [`criteria: [${input.criteria.join(', ')}]`] : []),
    ...(input.assignee ? [`assignee: ${input.assignee}`] : []),
    '---',
  ];
  return `${front.join('\n')}\n\n# ${input.id} ${input.title}\n\nTracked in [Issue #${input.issueNumber}](${input.issueUrl}). Ownership is recorded here; the Kanban column comes from the Issue.\n`;
}

/** The task line of a requirement: `- \`TASK-###\` Title — [GitHub Issue #n](url)`. */
export function taskListLine(id: string, title: string, issueNumber: number, issueUrl: string): string {
  return `- \`${id}\` ${title} — [GitHub Issue #${issueNumber}](${issueUrl})`;
}

/** The sentence that a requirement keeps under `## Tasks` until its first task exists. */
const PLACEHOLDER = /^Tasks are not created yet/i;

/** Appends a line to the list under `## Tasks`; undefined when the requirement has no such section. */
export function addTaskToRequirement(text: string, line: string): string | undefined {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const heading = lines.findIndex((l) => /^##\s+Tasks\s*$/.test(l));
  if (heading < 0) return undefined;
  let end = lines.findIndex((l, i) => i > heading && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  let last = -1;
  for (let i = heading + 1; i < end; i++) if (/^-\s/.test(lines[i])) last = i;
  if (last >= 0) {
    lines.splice(last + 1, 0, line);
  } else {
    // A section that only says no task exists yet is replaced by the list, not left next to it.
    const placeholder = lines.findIndex((l, i) => i > heading && i < end && PLACEHOLDER.test(l));
    if (placeholder >= 0) {
      let stop = placeholder;
      while (stop + 1 < end && lines[stop + 1].trim() !== '' && !/^-\s/.test(lines[stop + 1])) stop += 1;
      lines.splice(placeholder, stop - placeholder + 1, line);
    } else {
      lines.splice(heading + 1, 0, '', line);
    }
  }
  return lines.join(newline);
}

export interface TaskCreateInput {
  token: string;
  login: string | undefined;
  locale: Locale;
  project: { owner: string; number: number };
  requirement: RequirementArtifact;
  repository: string;
  title: string;
  criteria: string[];
  assigneeType: 'human' | 'agent';
  assignee?: string;
  area?: string;
  /** The number the new task takes. */
  number: number;
  /** Where task files live, relative to the folder that holds `fabric.yaml`. */
  taskDirectory: string;
  /** The folder that holds `fabric.yaml`. */
  root: string;
  system: System;
  fetch?: Fetch;
}

/**
 * Three actions that belong together: create the Issue, put it on the Project, and offer the task
 * file and the requirement's task line as a pull request. The pull request is made in a separate
 * worktree on a new branch, so the user's own checkout and the default branch stay untouched.
 */
export function planTaskCreate(input: TaskCreateInput): PlannedAction[] {
  const id = taskIdOf(input.number);
  const labels = ['task', 'status:backlog', ...(input.area ? [`area:${input.area}`] : [])];
  const taskPath = `${input.taskDirectory}/${id}.md`.replace(/^\.\//, '');
  const created: { number?: number; url?: string } = {};
  const reason = { code: 'cli.task-create.reason' as const };

  const issue: PlannedAction = {
    kind: 'issue.create',
    target: input.repository,
    summary: { code: 'cli.task-create.issue', args: { title: `[${id}] ${input.title}`, repository: input.repository, labels: labels.join(', ') } },
    reason,
    run: async () => {
      const body = `${attribution(input.locale, input.login)}\n\nA task of ${input.requirement.id} (${input.requirement.title}). The definition is ${taskPath}.`;
      const made = await createIssue(input.token, input.repository, { title: `[${id}] ${input.title}`, body, labels }, input.fetch);
      created.number = made.number;
      created.url = made.url;
    },
  };

  const card: PlannedAction = {
    kind: 'project.add',
    target: `${input.repository} ${id}`,
    summary: { code: 'cli.task-create.card', args: { owner: input.project.owner, number: input.project.number } },
    reason,
    dependsOn: [issue],
    run: async () => {
      if (!created.url) throw new NoticeError({ code: 'cli.err.issue-not-created' });
      await addIssueToProject(input.token, input.project, created.url, input.fetch);
    },
  };

  const branch = `docs/${id.toLowerCase()}-${slugOf(input.title)}`;
  const files: PlannedAction = {
    kind: 'files.pull-request',
    target: `${input.repository} ${branch}`,
    summary: { code: 'cli.task-create.files', args: { repository: input.repository, path: taskPath, task: id, requirement: input.requirement.id } },
    reason,
    dependsOn: [issue],
    run: async () => {
      if (!created.url || created.number === undefined) throw new NoticeError({ code: 'cli.err.issue-not-created' });
      const { system } = input;
      await openFilesPullRequest({
        system,
        root: input.root,
        repository: input.repository,
        branch,
        title: `docs: add ${id} ${input.title}`,
        commitMessage: `docs: add ${id} ${input.title}

${attribution(input.locale, input.login)}`,
        body: `${attribution(input.locale, input.login)}

Adds ${taskPath} and lists ${id} under ${input.requirement.id}. Issue: ${created.url}`,
        edit: async ({ work, top, base }) => {
          const relative = path.relative(top, path.resolve(input.root, input.requirement.path)).split(path.sep).join('/');
          const requirementText = await system.readText(path.join(work, relative));
          const updated = requirementText === undefined ? undefined : addTaskToRequirement(requirementText, taskListLine(id, input.title, created.number as number, created.url as string));
          if (updated === undefined) throw new NoticeError({ code: 'cli.err.no-tasks-section', args: { path: relative, base } });
          await system.writeFile(path.join(work, relative), updated);
          const taskRelative = path.relative(top, path.resolve(input.root, taskPath)).split(path.sep).join('/');
          await system.writeFile(
            path.join(work, taskRelative),
            renderTaskFile({
              id,
              title: input.title,
              requirement: input.requirement.id,
              issueUrl: created.url as string,
              issueNumber: created.number as number,
              repository: input.repository,
              criteria: input.criteria,
              assigneeType: input.assigneeType,
              assignee: input.assignee,
            }),
          );
        },
      });
    },
  };

  return [issue, card, files];
}

/** The artifacts that could take a task number, plus open pull requests when `gh` can list them. */
export async function usedTaskTexts(artifacts: readonly Artifact[], cards: readonly { title: string }[], repository: string, system: System): Promise<string[]> {
  const texts = [...artifacts.map((a) => a.id), ...cards.map((c) => c.title)];
  try {
    texts.push(await system.run('gh', ['pr', 'list', '--repo', repository, '--state', 'open', '--limit', '100', '--json', 'title,headRefName']));
  } catch {
    // Without the list of open pull requests the number is taken from the files and the Project only.
  }
  return texts;
}
