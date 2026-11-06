import { isMap, isScalar, isSeq, parseDocument, type Document, type YAMLMap, type YAMLSeq } from 'yaml';
import type { MessageArgs } from './i18n';
import { readRoster, type AddIssue, type Contributor } from './roster';

/**
 * Where the contributors are kept: the `roster.contributors` list of the personal configuration
 * (DEC-013, DEC-014), or the `contributors` list of a roster file of its own (DEC-017, TASK-074).
 */
export type RosterTarget = 'personal' | 'file';

export type RosterEdit =
  | { ok: true; text: string }
  | {
      ok: false;
      /** `invalid-yaml`: the text cannot be read. `invalid`: the contributor breaks a rule (see `issue`). `duplicate`/`not-found`: by id. `not-a-list`: `contributors` is not a list. */
      reason: 'invalid-yaml' | 'invalid' | 'duplicate' | 'not-found' | 'not-a-list';
      /** The validation rule that failed, with its arguments; the message is `validation.<code>`. */
      issue?: { code: string; args?: MessageArgs };
      detail?: string;
    };

const FIELDS = ['id', 'kind', 'name', 'github', 'tool', 'model', 'roles', 'reach'] as const;

const same = (a: unknown, b: string): boolean => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The entry as plain data in the order of the sample file, without the fields that are empty. */
function plain(contributor: Contributor): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of FIELDS) {
    const value = contributor[field];
    if (value === undefined || (Array.isArray(value) && value.length === 0) || value === '') continue;
    data[field] = Array.isArray(value) ? value.map((item) => (typeof item === 'object' ? { ...item } : item)) : value;
  }
  return data;
}

/** The first rule the entry breaks, judged by the same reader that reads the file back. */
function firstError(contributor: Contributor): { code: string; args?: MessageArgs } | undefined {
  let found: { code: string; args?: MessageArgs } | undefined;
  const add: AddIssue = (severity, code, args) => {
    if (severity === 'error' && !found) found = { code, ...(args ? { args } : {}) };
  };
  readRoster({ contributors: [plain(contributor)] }, add);
  return found;
}

function readDocument(text: string): Document | { error: string } {
  const document = parseDocument(text);
  if (document.errors.length > 0) return { error: document.errors[0].message };
  if (document.contents === null) document.contents = document.createNode({}) as never;
  if (!isMap(document.contents)) return { error: 'the file is not a mapping' };
  return document;
}

/** The mapping that holds `contributors`, made when it is missing. */
function holder(document: Document, target: RosterTarget, create: boolean): YAMLMap | undefined {
  const root = document.contents as YAMLMap;
  if (target === 'file') return root;
  const roster = root.get('roster', true);
  if (isMap(roster)) return roster;
  if (!create) return undefined;
  const made = document.createNode({}) as YAMLMap;
  root.set('roster', made);
  return made;
}

/** The list of contributors, made when it is missing. `null` when `contributors` exists and is not a list. */
function listOf(document: Document, parent: YAMLMap, create: boolean): YAMLSeq | null | undefined {
  const list = parent.get('contributors', true);
  if (isSeq(list)) return list;
  if (list !== undefined && list !== null) return null;
  if (!create) return undefined;
  const made = document.createNode([]) as YAMLSeq;
  parent.set('contributors', made);
  return made;
}

const indexOfId = (list: YAMLSeq, id: string): number => list.items.findIndex((item) => isMap(item) && same(item.get('id'), id));

/**
 * The text with one contributor added, or, when `replacing` names the id of an entry that exists,
 * changed (the id may change too). Without `replacing` the id must be new. Only that entry changes:
 * the comments of the file, the other entries, and the fields of the entry that the form does not
 * know (and their comments) stay as they are.
 */
export function upsertContributor(text: string, contributor: Contributor, target: RosterTarget, replacing?: string): RosterEdit {
  const issue = firstError(contributor);
  if (issue) return { ok: false, reason: 'invalid', issue };

  const document = readDocument(text);
  if ('error' in document) return { ok: false, reason: 'invalid-yaml', detail: document.error };
  const list = listOf(document, holder(document, target, true) as YAMLMap, true);
  if (list === null || list === undefined) return { ok: false, reason: 'not-a-list' };

  const at = replacing === undefined ? -1 : indexOfId(list, replacing);
  if (replacing !== undefined && at === -1) return { ok: false, reason: 'not-found' };
  const clash = indexOfId(list, contributor.id);
  if (clash !== -1 && clash !== at) return { ok: false, reason: 'duplicate', issue: { code: 'roster-duplicate-id', args: { id: contributor.id } } };

  const data = plain(contributor);
  const entry = at === -1 ? undefined : list.items[at];
  if (!isMap(entry)) {
    list.add(document.createNode(data));
  } else {
    for (const field of FIELDS) {
      if (!(field in data)) {
        entry.delete(field);
        continue;
      }
      const current = entry.get(field, true);
      const wanted = data[field];
      if (isScalar(current) && (typeof wanted === 'string' || typeof wanted === 'number')) current.value = wanted; // keeps the comment after the value
      else if (JSON.stringify(isMap(current) || isSeq(current) || isScalar(current) ? current.toJSON() : current) !== JSON.stringify(wanted)) entry.set(field, document.createNode(wanted));
    }
  }
  return { ok: true, text: String(document) };
}

/** The text without the contributor named by `id`. An empty list is left in place, so the file keeps its shape. */
export function removeContributor(text: string, id: string, target: RosterTarget): RosterEdit {
  const document = readDocument(text);
  if ('error' in document) return { ok: false, reason: 'invalid-yaml', detail: document.error };
  const parent = holder(document, target, false);
  const list = parent ? listOf(document, parent, false) : undefined;
  if (list === null) return { ok: false, reason: 'not-a-list' };
  const at = list ? indexOfId(list, id) : -1;
  if (!list || at === -1) return { ok: false, reason: 'not-found' };
  list.items.splice(at, 1);
  return { ok: true, text: String(document) };
}

/** What the editing form asks: every answer is text, and an empty one leaves the field out. */
export interface ContributorForm {
  id: string;
  kind: Contributor['kind'];
  name?: string;
  github?: string;
  tool?: string;
  model?: string;
  /** Roles separated by commas. */
  roles?: string;
  /** The label that sends work to an agent: the one reach entry Weaver acts on. */
  label?: string;
}

const clean = (value: string | undefined): string | undefined => (value && value.trim() !== '' ? value.trim() : undefined);

/** The label of a contributor's reach, as the form shows it. */
export function reachLabel(contributor: Pick<Contributor, 'reach'> | undefined): string | undefined {
  return Array.isArray(contributor?.reach) ? contributor.reach.find((entry) => entry.type === 'label')?.value : undefined;
}

/**
 * The entry the form describes. A reach that the form cannot show (a description in words, or an
 * entry that is not a label) is kept as it was; only the label is changed.
 */
export function contributorFromForm(form: ContributorForm, existing?: Contributor): Contributor {
  const roles = (form.roles ?? '').split(',').map((role) => role.trim()).filter((role) => role !== '');
  const label = clean(form.label);
  let reach: Contributor['reach'];
  if (Array.isArray(existing?.reach)) {
    const others = existing.reach.filter((entry) => entry.type !== 'label');
    const entries = [...(label ? [{ type: 'label', value: label }] : []), ...others];
    reach = entries.length > 0 ? entries : undefined;
  } else if (typeof existing?.reach === 'string') {
    reach = label ? [{ type: 'label', value: label }] : existing.reach;
  } else if (label) {
    reach = [{ type: 'label', value: label }];
  }
  return {
    id: form.id.trim(),
    kind: form.kind,
    ...(clean(form.name) ? { name: clean(form.name) } : {}),
    ...(clean(form.github) ? { github: clean(form.github) } : {}),
    ...(clean(form.tool) ? { tool: clean(form.tool) } : {}),
    ...(clean(form.model) ? { model: clean(form.model) } : {}),
    ...(roles.length > 0 ? { roles } : {}),
    ...(reach ? { reach } : {}),
  };
}
