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
  /** What it can take: plain strings. Weaver matches a task or a rule to a role and defines none (DEC-017). */
  roles?: string[];
  /**
   * For an agent: how work gets to it. A plain string is a description for a person (the form of
   * DEC-013); a list is `{type, value}` entries (DEC-017). Read it through `reachEntries`.
   */
  reach?: string | ReachEntry[];
}

/** One way work gets to a contributor. Weaver acts only on `label`; any other type is kept and shown. */
export interface ReachEntry {
  type: string;
  value: string;
}

/** The only reach type Weaver acts on: the value is a label added to the Issue (DEC-017). */
export const ACTED_REACH_TYPE = 'label';

/** Where a shared roster is read from: a file in a repository, at a branch, tag, or commit (DEC-017 item 4). */
export interface RosterRef {
  repository: string;
  path: string;
  /** Left out: the default branch of the repository. */
  ref?: string;
}

export interface Roster {
  contributors: Contributor[];
  /** The shared roster this one is laid over, when the file names one (`roster.from`). */
  from?: RosterRef;
}

/** The reach of a contributor as `{type, value}` entries: a plain string reads as `{type: text}`. */
export function reachEntries(contributor: Pick<Contributor, 'reach'>): ReachEntry[] {
  const { reach } = contributor;
  if (reach === undefined) return [];
  return typeof reach === 'string' ? [{ type: 'text', value: reach }] : reach;
}

export interface RosterParseResult {
  /** Present only when the file has no errors. Warnings do not hide it. */
  roster?: Roster;
  issues: ValidationIssue[];
}

const KNOWN_FIELDS = ['contributors', 'from'];
const KNOWN_ENTRY_FIELDS = ['id', 'kind', 'name', 'github', 'tool', 'model', 'roles', 'reach'];
const ID = /^[\w][\w .@-]*$/;

const isMapping = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

export type AddIssue = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) => void;

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Reads a reference to a roster, `{repository, path, ref}` (DEC-017 item 4). A reference that is
 * wrong is reported as a warning and ignored: a bad pointer must never stop Weaver from working.
 */
export function readRosterRef(data: unknown, add: AddIssue, field: string): RosterRef | undefined {
  if (data === undefined || data === null) return undefined;
  const repository = isMapping(data) ? str(data.repository) : undefined;
  const path = isMapping(data) ? str(data.path) : undefined;
  if (!isMapping(data) || !repository || !REPOSITORY.test(repository) || !path || path.startsWith('/') || path.split('/').includes('..')) {
    add('warning', 'roster-invalid-reference', { field });
    return undefined;
  }
  for (const key of Object.keys(data)) if (!['repository', 'path', 'ref'].includes(key)) add('warning', 'unknown-field', { field: `${field}.${key}` });
  const ref = str(data.ref);
  return { repository, path, ...(ref ? { ref } : {}) };
}

function readRoles(value: unknown, id: string, add: AddIssue): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const roles = Array.isArray(value) ? value.map(str) : undefined;
  if (!roles || roles.some((role) => role === undefined)) {
    add('warning', 'roster-invalid-roles', { id });
    return undefined;
  }
  return roles as string[];
}

/** `reach` is a string, or one `{type, value}` entry, or a list of them. An entry that is wrong is dropped with a warning. */
function readReach(value: unknown, id: string, add: AddIssue): string | ReachEntry[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return str(value);
  const entries: ReachEntry[] = [];
  for (const item of Array.isArray(value) ? value : [value]) {
    const type = isMapping(item) ? str(item.type) : undefined;
    const text = isMapping(item) ? str(item.value) : undefined;
    if (type && text) entries.push({ type, value: text });
    else add('warning', 'roster-invalid-reach', { id });
  }
  return entries.length ? entries : undefined;
}

/**
 * Reads the `roster` of the personal configuration (DEC-013, DEC-014): a mapping with a
 * `contributors` list. An agent without a `tool` or a `reach` is accepted with a warning, because
 * the roster is useful before it is complete. Returns the roster only when it has no errors.
 */
export function readRoster(data: unknown, add: AddIssue, options: { lenient?: boolean } = {}): Roster | undefined {
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

  // `from` names a shared roster. A file that only names one has no entries of its own.
  const from = readRosterRef(data.from, add, 'roster.from');
  const list = data.contributors;
  if ((list === undefined || list === null) && from) return { contributors: [], from };
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
    };
    const roles = readRoles(entry.roles, id, add);
    if (roles) contributor.roles = roles;
    const reach = readReach(entry.reach, id, add);
    if (reach) contributor.reach = reach;
    if (contributor.kind === 'agent') {
      for (const field of ['tool', 'reach'] as const) if (!contributor[field]) report('warning', 'roster-agent-incomplete', { id, field });
    }
    contributors.push(contributor);
  }

  // A roster read from a shared file keeps the entries that are right and leaves the others out (DEC-017 item 7).
  if (before.errors > 0 && !options.lenient) return undefined;
  if (contributors.length === 0 && !from) {
    report('error', 'roster-no-contributors');
    return undefined;
  }
  return { contributors, ...(from ? { from } : {}) };
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

/**
 * Reads a shared roster file (DEC-017). Unlike the personal roster, nothing in it is an error: an
 * entry that is wrong is left out with a warning, and the others still apply, so one slip in a file
 * an organization owns never stops Weaver from working. With no usable entry there is no roster.
 */
export function parseSharedRoster(path: string, text: string): RosterParseResult {
  const issues: ValidationIssue[] = [];
  const add: AddIssue = (_severity, code, args) => issues.push({ severity: 'warning', code, ...(args ? { args } : {}), path });
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    add('warning', 'roster-invalid-yaml', { detail: (error as Error).message });
    return { issues };
  }
  const roster = readRoster(data, add, { lenient: true });
  return roster && roster.contributors.length > 0 ? { roster, issues } : { issues };
}

/** Where the fields of a contributor of the combined roster come from. */
export type RosterOrigin = 'shared' | 'personal' | 'both';

export interface RosterOverlay {
  roster: Roster;
  /** By id without regard to case. A difference between the two is shown, not hidden (DEC-017 item 6). */
  origins: Map<string, RosterOrigin>;
}

/**
 * Lays the personal roster over the shared one (DEC-017 item 6). An id in both (without regard to
 * case) takes the fields the personal entry sets and keeps the rest from the shared entry; `roles`
 * and `reach` of the personal entry replace the shared ones as a whole. An id only in the personal
 * roster is added. A personal roster never removes a shared contributor. With no shared roster the
 * personal one is returned as it is.
 */
export function overlayRoster(shared: Roster | undefined, personal: Roster | undefined): RosterOverlay | undefined {
  if (!shared && !personal) return undefined;
  const origins = new Map<string, RosterOrigin>();
  if (!shared) {
    for (const c of personal?.contributors ?? []) origins.set(c.id.toLowerCase(), 'personal');
    return { roster: personal as Roster, origins };
  }
  const byId = new Map<string, Contributor>();
  for (const c of shared.contributors) {
    byId.set(c.id.toLowerCase(), { ...c });
    origins.set(c.id.toLowerCase(), 'shared');
  }
  for (const c of personal?.contributors ?? []) {
    const key = c.id.toLowerCase();
    const base = byId.get(key);
    byId.set(key, base ? { ...base, ...c, id: base.id } : { ...c });
    origins.set(key, base ? 'both' : 'personal');
  }
  return { roster: { contributors: [...byId.values()] }, origins };
}
