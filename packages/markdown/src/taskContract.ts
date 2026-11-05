import type { MessageArgs, Notice } from './i18n';
import { RESERVED_TASK_KEYS } from './parse';

/**
 * The task contract an organization declares in the `task` section of `.weaver/process.yaml`
 * (DEC-016). Weaver carries it out and knows nothing of what a field means.
 */
export const TASK_FIELD_SOURCES = ['file', 'project'] as const;
export type TaskFieldSource = (typeof TASK_FIELD_SOURCES)[number];

export interface TaskField {
  /** Lowercase letters, digits, and hyphens. In a task file it is a key of the front matter. */
  name: string;
  required: boolean;
  /** The allowed values, when the field has a closed list. */
  values?: string[];
  /** `file`: the task file is the source of truth. `project`: the value lives only on the board. */
  source: TaskFieldSource;
  /** An Issue label template that contains `{value}`. */
  label?: string;
  /** The name of a Project field. A field has at most one of `label` and `projectField`. */
  projectField?: string;
}

export interface TaskContract {
  /** `false` lets a task be an Issue with no file. */
  requireFile: boolean;
  fields: TaskField[];
  /** The headings a task body should contain, in this order. */
  sections: string[];
}

const KNOWN_FIELDS = ['require-file', 'fields', 'body'];
const KNOWN_FIELD_KEYS = ['required', 'values', 'source', 'label', 'project-field'];
const FIELD_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isMapping = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

type Add = (severity: 'error' | 'warning', code: string, args?: MessageArgs) => void;

/**
 * Reads the `task` section (DEC-016 items 3 to 8). Every mistake in it is an error of the section,
 * so the caller ignores the whole section and the other sections still apply (DEC-015 item 6).
 */
export function readTaskContract(data: Record<string, unknown>, add: Add): TaskContract {
  const contract: TaskContract = { requireFile: true, fields: [], sections: [] };
  for (const key of Object.keys(data)) if (!KNOWN_FIELDS.includes(key)) add('warning', 'unknown-field', { field: `task.${key}` });

  if (data['require-file'] !== undefined) {
    if (typeof data['require-file'] === 'boolean') contract.requireFile = data['require-file'];
    else add('error', 'process-task-invalid-value', { field: 'task.require-file' });
  }

  if (data.fields !== undefined) {
    if (!isMapping(data.fields)) {
      add('error', 'process-section-not-a-mapping', { section: 'task.fields' });
    } else {
      for (const [name, value] of Object.entries(data.fields)) {
        const field = readField(name, value, add);
        if (field) contract.fields.push(field);
      }
    }
  }

  if (data.body !== undefined) {
    if (!isMapping(data.body)) {
      add('error', 'process-section-not-a-mapping', { section: 'task.body' });
    } else {
      for (const key of Object.keys(data.body)) if (key !== 'sections') add('warning', 'unknown-field', { field: `task.body.${key}` });
      const sections = data.body.sections;
      if (sections !== undefined) {
        const list = Array.isArray(sections) ? sections.map(str) : undefined;
        if (!list || list.some((s) => s === undefined)) add('error', 'process-task-invalid-value', { field: 'task.body.sections' });
        else contract.sections = list as string[];
      }
    }
  }
  return contract;
}

function readField(name: string, value: unknown, add: Add): TaskField | undefined {
  const where = `task.fields.${name}`;
  if (!FIELD_NAME.test(name)) {
    add('error', 'process-task-invalid-field-name', { field: name });
    return undefined;
  }
  if ((RESERVED_TASK_KEYS as readonly string[]).includes(name.replace(/-/g, '_')) || (RESERVED_TASK_KEYS as readonly string[]).includes(name)) {
    add('error', 'process-task-reserved-field', { field: name });
    return undefined;
  }
  // A field with no keys at all ("owner:" with nothing under it) is an optional file field.
  const data = value === null || value === undefined ? {} : value;
  if (!isMapping(data)) {
    add('error', 'process-section-not-a-mapping', { section: where });
    return undefined;
  }
  for (const key of Object.keys(data)) if (!KNOWN_FIELD_KEYS.includes(key)) add('warning', 'unknown-field', { field: `${where}.${key}` });

  let ok = true;
  const field: TaskField = { name, required: false, source: 'file' };
  if (data.required !== undefined) {
    if (typeof data.required === 'boolean') field.required = data.required;
    else ok = fail(add, where, 'required');
  }
  if (data.source !== undefined) {
    if ((TASK_FIELD_SOURCES as readonly unknown[]).includes(data.source)) field.source = data.source as TaskFieldSource;
    else ok = fail(add, where, 'source');
  }
  if (data.values !== undefined) {
    const list = Array.isArray(data.values) ? data.values.map((v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : str(v))) : undefined;
    if (!list || list.length === 0 || list.some((v) => v === undefined)) ok = fail(add, where, 'values');
    else field.values = list as string[];
  }
  if (data.label !== undefined) {
    const label = str(data.label);
    if (!label) ok = fail(add, where, 'label');
    else if (!label.includes('{value}')) {
      add('error', 'process-task-label-template', { field: name });
      ok = false;
    } else field.label = label;
  }
  if (data['project-field'] !== undefined) {
    const projectField = str(data['project-field']);
    if (!projectField) ok = fail(add, where, 'project-field');
    else field.projectField = projectField;
  }
  // DEC-016 item 6: at most one place on the board.
  if (field.label && field.projectField) {
    add('error', 'process-task-two-mappings', { field: name });
    ok = false;
  }
  // DEC-016 item 5: a field that lives on the board needs somewhere to live.
  if (field.source === 'project' && !field.label && !field.projectField) {
    add('error', 'process-task-source-without-mapping', { field: name });
    ok = false;
  }
  return ok ? field : undefined;
}

function fail(add: Add, where: string, key: string): false {
  add('error', 'process-task-invalid-value', { field: `${where}.${key}` });
  return false;
}

/** What `task create` writes for the declared fields, ready to be shown in the plan. */
export interface TaskFieldPlan {
  /** Front matter keys of the task file, for the fields whose source is `file`. */
  fileFields: { name: string; value: string }[];
  /** Issue labels projected from fields that map to a label. */
  labels: string[];
  /** Project fields to set on the new card. */
  projectFields: { field: string; value: string }[];
  /** The empty headings of the task body. */
  sections: string[];
  /** Problems with what was given, as gaps. A non-empty list stops the plan. */
  gaps: Notice[];
}

/** The text of a label template for a value. */
export const labelOf = (template: string, value: string): string => template.split('{value}').join(value);

/**
 * Fills the contract from the values a person gave (DEC-016 item 10). A required field with no
 * value, a value outside `values`, and a name the contract does not declare are gaps; nothing is
 * guessed, so a card is never created half filled.
 */
export function planTaskFields(contract: TaskContract, given: Readonly<Record<string, string>>): TaskFieldPlan {
  const plan: TaskFieldPlan = { fileFields: [], labels: [], projectFields: [], sections: [...contract.sections], gaps: [] };
  const declared = new Set(contract.fields.map((f) => f.name));
  for (const name of Object.keys(given)) if (!declared.has(name)) plan.gaps.push({ code: 'gap.task-field-undeclared', args: { field: name } });

  for (const field of contract.fields) {
    const value = given[field.name]?.trim();
    if (!value) {
      if (field.required) plan.gaps.push({ code: 'gap.task-field-missing', args: { field: field.name } });
      continue;
    }
    if (field.values && !field.values.includes(value)) {
      plan.gaps.push({ code: 'gap.task-field-value', args: { field: field.name, value, values: field.values } });
      continue;
    }
    // A `project` field lives only on the board: the task file does not carry it (DEC-016 item 5).
    if (field.source === 'file') plan.fileFields.push({ name: field.name, value });
    if (field.label) plan.labels.push(labelOf(field.label, value));
    if (field.projectField) plan.projectFields.push({ field: field.projectField, value });
  }
  return plan;
}

/** The kinds of difference between a task and the contract (DEC-016 item 9), apart from a missing body section. */
export type ContractGapKind = 'task-field-missing' | 'task-field-value' | 'task-field-differs' | 'task-field-in-file';

export interface ContractGap {
  kind: ContractGapKind;
  /** Message arguments; the catalog key is `mismatch.<kind>`. */
  args: MessageArgs;
}

/** What the board shows for a task: the labels of its Issue and, when they were read, its Project fields. */
export interface BoardProjection {
  labels: readonly string[];
  /** The values of the Project fields that were read. A missing entry is a field with no value. Left out, Project fields are not judged. */
  fields?: Readonly<Record<string, string>>;
}

/** The text of a field in a task file, or undefined when it is empty. */
function fileValue(frontmatter: Record<string, unknown>, name: string): string | undefined {
  const value = frontmatter[name];
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/** The value a label of the template carries, or undefined when the label is not of the template. */
function valueOfLabel(template: string, label: string): string | undefined {
  const [head, ...rest] = template.split('{value}');
  const tail = rest.join('{value}');
  if (!label.startsWith(head) || !label.endsWith(tail) || label.length <= head.length + tail.length) return undefined;
  return label.slice(head.length, label.length - tail.length);
}

/**
 * Judges a task file against the contract of its repository (DEC-016 items 5 and 9). A required
 * `file` field with no value, a value outside `values`, a `project` field written in the file, and,
 * when the board is given, a `file` field that differs from its label or Project field are gaps.
 * The file wins, so a gap always says what the board should show. The caller names the task.
 */
export function contractGaps(frontmatter: Record<string, unknown>, contract: TaskContract, board?: BoardProjection): ContractGap[] {
  const gaps: ContractGap[] = [];
  for (const field of contract.fields) {
    const value = fileValue(frontmatter, field.name);
    if (field.source === 'project') {
      if (value !== undefined) gaps.push({ kind: 'task-field-in-file', args: { field: field.name } });
      continue;
    }
    if (value === undefined) {
      if (field.required) gaps.push({ kind: 'task-field-missing', args: { field: field.name } });
      continue;
    }
    if (field.values && !field.values.includes(value)) {
      gaps.push({ kind: 'task-field-value', args: { field: field.name, value, values: field.values.join(', ') } });
      continue;
    }
    if (!board) continue;
    if (field.label) {
      const expected = labelOf(field.label, value);
      if (!board.labels.includes(expected)) {
        const shown = board.labels.map((label) => valueOfLabel(field.label as string, label)).find((v) => v !== undefined);
        gaps.push({ kind: 'task-field-differs', args: { field: field.name, file: value, board: shown ?? '-' } });
      }
    } else if (field.projectField && board.fields) {
      const shown = board.fields[field.projectField];
      if (shown !== value) gaps.push({ kind: 'task-field-differs', args: { field: field.name, file: value, board: shown ?? '-' } });
    }
  }
  return gaps;
}

/**
 * The task fields declared by the process of the repository a task file is in: of the process files
 * whose folder holds the task file, the one with the longest folder. `root` is the process file's
 * path without `.weaver/process.yaml`, and may be empty.
 */
export function declaredTaskFieldsOf(declared: readonly { root: string; fields: readonly string[] }[], taskPath: string): readonly string[] {
  let best: { root: string; fields: readonly string[] } | undefined;
  for (const item of declared) {
    if (taskPath.startsWith(item.root) && (!best || item.root.length > best.root.length)) best = item;
  }
  return best?.fields ?? [];
}
