import type { Notice } from './i18n';
import { yamlValue } from './frontmatter';
import type { Contributor } from './roster';
import type { TaskArtifact } from './types';

export type AssignRole = 'assignee' | 'reviewer' | 'approval';

export interface AssignPlan {
  /** Fields to set in the task file's frontmatter, already written as YAML values. */
  fields: Record<string, string>;
  /** What will change, one notice per line, for the confirmation dialog. */
  changes: Notice[];
  /** The Issue assignees to set, when the Issue changes too. Left out when the Issue stays as it is. */
  issueAssignees?: string[];
}

export interface AssignInput {
  role: AssignRole;
  /** The task as its file says now. */
  task: Pick<TaskArtifact, 'assignee' | 'assigneeType' | 'reviewer' | 'approvedBy' | 'approvedOn'>;
  /** The contributor chosen from the roster, or a name typed by hand when there is no roster. */
  who: Pick<Contributor, 'id' | 'kind'> & Partial<Pick<Contributor, 'github'>>;
  /** The Issue's assignees now, when they were read. */
  issueAssignees?: readonly string[];
  /** Today, as `YYYY-MM-DD`, for an approval. */
  date: string;
}

const NONE = '—';

const file = (field: string, from: string | undefined, to: string): Notice => ({
  code: 'assign.change-file',
  args: { field, from: from ?? NONE, to },
});

/**
 * What it takes to give a task an owner, name its reviewer, or record who approved it, for the
 * confirmation the person sees before anything is written (REQ-002, DEC-013). A change that
 * would not change anything is not listed.
 *
 * A human owner with a GitHub login becomes the Issue assignee too, so the file and the Issue
 * stay in step. An agent has no GitHub account in the usual case, so the Issue stays as it is.
 */
export function planAssignment(input: AssignInput): AssignPlan {
  const { role, task, who } = input;
  const fields: Record<string, string> = {};
  const changes: Notice[] = [];
  const set = (field: string, from: string | undefined, to: string, written = to) => {
    fields[field] = written;
    if (from !== to) changes.push(file(field, from, to));
  };

  if (role === 'assignee') {
    set('assignee', task.assignee, who.id, yamlValue(who.id));
    set('assignee_type', task.assigneeType, who.kind);
    if (who.kind === 'human' && who.github) {
      const now = input.issueAssignees;
      const same = now !== undefined && now.length === 1 && now[0].toLowerCase() === who.github.toLowerCase();
      if (!same) {
        changes.push({ code: 'assign.change-issue', args: { from: now === undefined ? '?' : now.length ? now.join(', ') : NONE, to: who.github } });
      }
      return { fields, changes, issueAssignees: [who.github] };
    }
    changes.push({ code: who.kind === 'agent' ? 'assign.issue-unchanged-agent' : 'assign.issue-unchanged-no-login' });
    return { fields, changes };
  }

  if (role === 'reviewer') {
    set('reviewer', task.reviewer, who.id, yamlValue(who.id));
    return { fields, changes };
  }

  set('approved_by', task.approvedBy, who.id, yamlValue(who.id));
  fields.approved_on = JSON.stringify(input.date);
  if (task.approvedOn !== input.date) changes.push(file('approved_on', task.approvedOn, input.date));
  return { fields, changes };
}
