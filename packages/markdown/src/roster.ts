import { parse as parseYaml } from 'yaml';
import type { MessageArgs, Notice } from './i18n';
import type { KanbanColumn } from './kanban';
import type { TaskArtifact, ValidationIssue } from './types';

export const CONTRIBUTOR_KINDS = ['human', 'agent'] as const;
export type ContributorKind = (typeof CONTRIBUTOR_KINDS)[number];

/** One entry of the roster (DEC-013): a person or an agent that tasks can be given to. */
export interface Contributor {
  /** The name task files use (`assignee`, `reviewer`, `approved_by`). */
  id: string;
  kind: ContributorKind;
  /** A display name, when `id` is not enough. */
  name?: string;
  /** The GitHub login. For a human it becomes the Issue assignee. */
  github?: string;
  /** For an agent: the tool or product, such as "Claude Code". */
  tool?: string;
  /** For an agent: the model, when it matters. */
  model?: string;
  /** For an agent: how it is reached (a command, a service, a channel). */
  reach?: string;
}

export interface Roster {
  contributors: Contributor[];
}

export interface RosterParseResult {
  /** Present only when the file has no errors. Warnings do not hide it. */
  roster?: Roster;
  issues: ValidationIssue[];
}

const KNOWN_FIELDS = ['contributors'];
const KNOWN_ENTRY_FIELDS = ['id', 'kind', 'name', 'github', 'tool', 'model', 'reach'];
const ID = /^[\w][\w .@-]*$/;

const isMapping = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

export type AddIssue = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) => void;

/**
 * Reads the `roster` of the personal configuration (DEC-013, DEC-014): a mapping with a
 * `contributors` list. An agent without a `tool` or a `reach` is accepted with a warning, because
 * the roster is useful before it is complete. Returns the roster only when it has no errors.
 */
export function readRoster(data: unknown, add: AddIssue): Roster | undefined {
  const before = { errors: 0 };
  const report: AddIssue = (severity, code, args) => {
    if (severity === 'error') before.errors += 1;
    add(severity, code, args);
  };

  if (!isMapping(data)) {
    report('error', 'roster-not-a-mapping');
    return undefined;
  }
  for (const field of Object.keys(data)) if (!KNOWN_FIELDS.includes(field)) report('warning', 'unknown-field', { field: `roster.${field}` });

  const list = data.contributors;
  if (list === undefined || list === null) {
    report('error', 'missing-field', { field: 'roster.contributors' });
    return undefined;
  }
  if (!Array.isArray(list)) {
    report('error', 'roster-not-a-list');
    return undefined;
  }

  const contributors: Contributor[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (!isMapping(entry)) {
      report('error', 'roster-invalid-entry');
      continue;
    }
    for (const field of Object.keys(entry)) if (!KNOWN_ENTRY_FIELDS.includes(field)) report('warning', 'unknown-field', { field: `roster.contributors.${field}` });

    const id = str(entry.id);
    if (!id) {
      report('error', 'missing-field', { field: 'roster.contributors.id' });
      continue;
    }
    if (!ID.test(id)) {
      report('error', 'roster-invalid-id', { id });
      continue;
    }
    const kind = str(entry.kind);
    if (!kind) {
      report('error', 'missing-field', { field: `roster.contributors.${id}.kind` });
      continue;
    }
    if (!(CONTRIBUTOR_KINDS as readonly string[]).includes(kind)) {
      report('error', 'roster-invalid-kind', { id, kind });
      continue;
    }
    // Names are matched without case, as GitHub logins are.
    if (seen.has(id.toLowerCase())) {
      report('error', 'roster-duplicate-id', { id });
      continue;
    }
    seen.add(id.toLowerCase());

    const contributor: Contributor = {
      id,
      kind: kind as ContributorKind,
      ...(str(entry.name) ? { name: str(entry.name) } : {}),
      ...(str(entry.github) ? { github: str(entry.github) } : {}),
      ...(str(entry.tool) ? { tool: str(entry.tool) } : {}),
      ...(str(entry.model) ? { model: str(entry.model) } : {}),
      ...(str(entry.reach) ? { reach: str(entry.reach) } : {}),
    };
    if (contributor.kind === 'agent') {
      for (const field of ['tool', 'reach'] as const) if (!contributor[field]) report('warning', 'roster-agent-incomplete', { id, field });
    }
    contributors.push(contributor);
  }

  if (before.errors > 0) return undefined;
  if (contributors.length === 0) {
    report('error', 'roster-no-contributors');
    return undefined;
  }
  return { contributors };
}

/** A standalone YAML text with a `contributors` list, for tests and for a roster kept in its own file. */
export function parseRoster(path: string, text: string): RosterParseResult {
  const issues: ValidationIssue[] = [];
  const add: AddIssue = (severity, code, args) => issues.push({ severity, code, ...(args ? { args } : {}), path });
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    add('error', 'roster-invalid-yaml', { detail: (error as Error).message });
    return { issues };
  }
  const roster = readRoster(data, add);
  return roster ? { roster, issues } : { issues };
}

/** A contributor named by `id` or by GitHub login, without regard to case. */
export function findContributor(roster: Roster | undefined, name: string | undefined): Contributor | undefined {
  if (!roster || !name) return undefined;
  const wanted = name.trim().toLowerCase();
  return roster.contributors.find((c) => c.id.toLowerCase() === wanted || c.github?.toLowerCase() === wanted);
}

/**
 * What is wrong with who works on, reviews, and approves a task, judged against the roster. With no
 * roster there is nothing to judge against, so a repository that has not adopted one sees no gaps.
 * Work done by an agent that is in Verified needs a human approval on record (REQ-002).
 */
export function rosterGaps(task: Pick<TaskArtifact, 'assignee' | 'assigneeType' | 'reviewer' | 'approvedBy'>, column: KanbanColumn | undefined, roster: Roster | undefined): Notice[] {
  if (!roster) return [];
  const gaps: Notice[] = [];
  const owner = findContributor(roster, task.assignee);
  if (task.assignee && !owner) gaps.push({ code: 'gap.owner-not-in-roster', args: { owner: task.assignee } });
  if (task.reviewer && !findContributor(roster, task.reviewer)) gaps.push({ code: 'gap.reviewer-not-in-roster', args: { reviewer: task.reviewer } });

  const approver = findContributor(roster, task.approvedBy);
  if (task.approvedBy && !approver) gaps.push({ code: 'gap.approver-not-in-roster', args: { approver: task.approvedBy } });
  else if (approver && approver.kind !== 'human') gaps.push({ code: 'gap.approver-not-human', args: { approver: approver.id } });

  const byAgent = (owner?.kind ?? task.assigneeType) === 'agent';
  if (byAgent && column === 'Verified' && !approver) gaps.push({ code: 'gap.no-human-approval' });
  return gaps;
}
