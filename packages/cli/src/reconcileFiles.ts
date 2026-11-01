import * as path from 'path';
import { Artifact, Locale, RequirementArtifact, setFrontmatterFields, TaskArtifact } from '@palab/weaver-markdown';
import { addIssueToProject, createIssue, fetchIssueBody, NoticeError, type Fetch, type FetchFn, type ProjectCard } from '@palab/weaver-github';
import { attribution, PlannedAction } from './actions';
import type { System } from './contract';
import { openFilesPullRequest, pullRequestOpen } from './filesPullRequest';
import { addTaskToRequirement, nextTaskNumber, renderTaskFile, taskIdOf, taskListLine } from './taskCreate';

/** What the two fixes that change repository files need to know (DEC-012, TASK-053). */
export interface FilesContext {
  token: string;
  login: string | undefined;
  locale: Locale;
  project: { owner: string; number: number };
  system: System;
  /** The folder of the user's checkout that holds the repository files. */
  root: string;
  /** Where task files live, relative to `root`. */
  taskDirectory: string;
  fetch?: Fetch;
  fetchFn?: FetchFn;
  /** Texts that hold task numbers already taken in a repository, for numbering a new task. */
  usedTexts(repository: string): Promise<string[]>;
  /** Task IDs this plan has already given out, so two drafts never take the same number. */
  planned: string[];
}

const relativeTo = (top: string, root: string, file: string): string => path.relative(top, path.resolve(root, file)).split(path.sep).join('/');

/**
 * Adds the Issue link to the line of a task under `## Tasks` that has none, so the list agrees with
 * the task file. A requirement whose line is missing or already has a link is returned as it is.
 */
export function linkTaskLine(text: string, id: string, number: number, url: string): string {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => new RegExp(`^-\\s+\`${id}\``).test(line));
  if (index < 0 || /github\.com\/[^\s)]+\/issues\//.test(lines[index])) return text;
  lines[index] = `${lines[index].replace(/\s+$/, '')} — [GitHub Issue #${number}](${url})`;
  return lines.join(newline);
}

/** A task of another repository's files cannot be fixed from this checkout, so only the same repository is offered. */
const sameRepository = (a: string | undefined, b: string | undefined): boolean => a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();

/**
 * A task file without an Issue: create the Issue, put it on the Project, and offer a pull request
 * that writes the Issue link into the task file (and into the requirement's task line). When the
 * Project already has a card titled with the task, that Issue is linked and none is created.
 * Returns nothing when the fix cannot be offered safely, so the mismatch stays a report.
 */
export async function planLinkIssue(ctx: FilesContext, task: TaskArtifact, requirement: RequirementArtifact | undefined, cards: readonly ProjectCard[]): Promise<PlannedAction[] | undefined> {
  const repository = task.repository ?? requirement?.repository;
  if (!repository) return undefined;
  const branch = `docs/${task.id.toLowerCase()}-link-issue`;
  if (await pullRequestOpen(ctx.system, repository, branch)) return undefined;

  const existing = cards.find((card) => card.taskId === task.id && sameRepository(card.repository, repository));
  const created: { number?: number; url?: string } = existing ? { number: existing.number, url: existing.url } : {};
  const reason = { code: 'cli.reconcile.link-issue-reason' as const };
  const actions: PlannedAction[] = [];
  let issue: PlannedAction | undefined;

  if (!existing) {
    const labels = ['task', 'status:backlog'];
    issue = {
      kind: 'issue.create',
      target: repository,
      summary: { code: 'cli.task-create.issue', args: { title: `[${task.id}] ${task.title}`, repository, labels: labels.join(', ') } },
      reason,
      run: async () => {
        const body = `${attribution(ctx.locale, ctx.login)}\n\nA task${requirement ? ` of ${requirement.id} (${requirement.title})` : ''}. The definition is ${task.path}.`;
        const made = await createIssue(ctx.token, repository, { title: `[${task.id}] ${task.title}`, body, labels }, ctx.fetch);
        created.number = made.number;
        created.url = made.url;
      },
    };
    actions.push(issue, {
      kind: 'project.add',
      target: `${repository} ${task.id}`,
      summary: { code: 'cli.task-create.card', args: { owner: ctx.project.owner, number: ctx.project.number } },
      reason,
      dependsOn: [issue],
      run: async () => {
        if (!created.url) throw new NoticeError({ code: 'cli.err.issue-not-created' });
        await addIssueToProject(ctx.token, ctx.project, created.url, ctx.fetch);
      },
    });
  }

  actions.push({
    kind: 'files.pull-request',
    target: `${repository} ${branch}`,
    summary: { code: 'cli.reconcile.link-files', args: { repository, path: task.path, task: task.id } },
    reason,
    ...(issue ? { dependsOn: [issue] } : {}),
    run: async () => {
      if (!created.url || created.number === undefined) throw new NoticeError({ code: 'cli.err.issue-not-created' });
      const { system } = ctx;
      await openFilesPullRequest({
        system,
        root: ctx.root,
        repository,
        branch,
        title: `docs: link ${task.id} to its Issue`,
        commitMessage: `docs: link ${task.id} to its Issue\n\n${attribution(ctx.locale, ctx.login)}`,
        body: `${attribution(ctx.locale, ctx.login)}\n\nWrites the Issue link into ${task.path}${requirement ? ` and the line of ${task.id} in ${requirement.path}` : ''}. Issue: ${created.url}`,
        edit: async ({ work, top }) => {
          const taskFile = relativeTo(top, ctx.root, task.path);
          const taskText = await system.readText(path.join(work, taskFile));
          const updated = taskText === undefined ? undefined : setFrontmatterFields(taskText, { issue: created.url as string });
          if (updated === undefined) throw new NoticeError({ code: 'cli.err.no-frontmatter', args: { path: taskFile } });
          await system.writeFile(path.join(work, taskFile), updated);
          if (requirement) {
            const requirementFile = relativeTo(top, ctx.root, requirement.path);
            const requirementText = await system.readText(path.join(work, requirementFile));
            if (requirementText !== undefined) await system.writeFile(path.join(work, requirementFile), linkTaskLine(requirementText, task.id, created.number as number, created.url as string));
          }
        },
      });
    },
  });
  return actions;
}

/** The `REQ-###` IDs a text names, in order and without repeats. */
const requirementIdsIn = (text: string): string[] => [...new Set(text.match(/\bREQ-\d{3,}\b/g) ?? [])];

/**
 * A card with no task file: offer a pull request that drafts the task file from the Issue and lists
 * it under its requirement. The requirement is the one the Issue names (`REQ-###` in its title or
 * body) among the requirements of the same repository; when none can be named, nothing is offered
 * and the mismatch stays a report. The draft is a starting point: the owner and criteria are for
 * the reviewer to fill in.
 */
export async function planDraftTask(ctx: FilesContext, card: ProjectCard, artifacts: readonly Artifact[]): Promise<PlannedAction[] | undefined> {
  const requirements = artifacts.filter((a): a is RequirementArtifact => a.kind === 'requirement' && sameRepository(a.repository, card.repository));
  const body = await fetchIssueBody(ctx.token, card.repository, card.number, ctx.fetchFn).catch(() => undefined);
  const named = requirementIdsIn(`${card.title}\n${body ?? ''}`);
  const requirement = named.map((id) => requirements.find((r) => r.id === id)).find((r) => r !== undefined);
  if (!requirement) return undefined;

  const title = card.title.replace(/^\[TASK-\d{3,}\]\s*/i, '').trim();
  if (!title || /[:\n]/.test(title)) return undefined;
  let id = card.taskId;
  if (id && artifacts.some((a) => a.kind === 'task' && a.id === id)) return undefined;
  if (!id) {
    const used = [...artifacts.map((a) => a.id), ...ctx.planned, ...(await ctx.usedTexts(card.repository))];
    id = taskIdOf(nextTaskNumber(used));
  }
  ctx.planned.push(id);

  const branch = `docs/${id.toLowerCase()}-draft-from-issue`;
  if (await pullRequestOpen(ctx.system, card.repository, branch)) return undefined;
  const taskPath = `${ctx.taskDirectory}/${id}.md`.replace(/^\.\//, '');
  const taskId = id;
  const ref = `${card.repository}#${card.number}`;

  return [
    {
      kind: 'files.pull-request',
      target: `${card.repository} ${branch}`,
      summary: { code: 'cli.reconcile.draft-files', args: { repository: card.repository, path: taskPath, ref, task: taskId, requirement: requirement.id } },
      reason: { code: 'cli.reconcile.draft-reason' },
      run: async () => {
        const { system } = ctx;
        await openFilesPullRequest({
          system,
          root: ctx.root,
          repository: card.repository,
          branch,
          title: `docs: draft ${taskId} from ${ref}`,
          commitMessage: `docs: draft ${taskId} from ${ref}\n\n${attribution(ctx.locale, ctx.login)}`,
          body: `${attribution(ctx.locale, ctx.login)}\n\nDrafts ${taskPath} for ${card.url} and lists ${taskId} under ${requirement.id}. The owner and the criteria are guesses: please check them before merging.`,
          edit: async ({ work, top, base }) => {
            const requirementFile = relativeTo(top, ctx.root, requirement.path);
            const requirementText = await system.readText(path.join(work, requirementFile));
            const line = taskListLine(taskId, title, card.number, card.url);
            const updated = requirementText === undefined ? undefined : addTaskToRequirement(requirementText, line);
            if (updated === undefined) throw new NoticeError({ code: 'cli.err.no-tasks-section', args: { path: requirementFile, base } });
            await system.writeFile(path.join(work, requirementFile), updated);
            await system.writeFile(
              path.join(work, relativeTo(top, ctx.root, taskPath)),
              renderTaskFile({
                id: taskId,
                title,
                requirement: requirement.id,
                issueUrl: card.url,
                issueNumber: card.number,
                repository: card.repository,
                criteria: [],
                assigneeType: card.assignees.length ? 'human' : 'agent',
                ...(card.assignees[0] ? { assignee: card.assignees[0] } : {}),
              }),
            );
          },
        });
      },
    },
  ];
}
