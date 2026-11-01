import { parse as parseYaml } from 'yaml';
import type { MessageArgs } from './i18n';
import { KANBAN_COLUMNS, KanbanColumn, LABEL_FOR_COLUMN } from './kanban';
import { DEFAULT_STALE_DAYS } from './stale';
import type { ValidationIssue } from './types';

export const COLUMN_SOURCES = ['labels', 'board-status'] as const;
export type ColumnSource = (typeof COLUMN_SOURCES)[number];

export const PULL_REQUEST_EXPECTATIONS = ['required', 'optional'] as const;
export type PullRequestExpectation = (typeof PULL_REQUEST_EXPECTATIONS)[number];

/** How a repository tracks its work (DEC-015). Every field has a default that is today's behavior. */
export interface ProcessConfig {
  columns: {
    /** Where a card's column comes from. */
    source: ColumnSource;
    /** Column to `status:*` label, used when the source is `labels`. */
    labels: Record<KanbanColumn, string>;
    /** Project board Status option to column, used when the source is `board-status`. */
    board: Record<string, KanbanColumn>;
  };
  evidence: {
    /** Whether a pull request is expected in Review and Verified. */
    pullRequest: PullRequestExpectation;
    /** Verified needs a merged pull request that closes the Issue (DEC-006). */
    closingPullRequest: boolean;
    /** An `evidence_exception` in a task file is honored (DEC-006). */
    exceptions: boolean;
  };
  stale: {
    /** Days without a change before an open card in an active column is idle. */
    idleDays: number;
  };
}

export const PROCESS_SECTIONS = ['columns', 'evidence', 'stale'] as const;
export type ProcessSection = (typeof PROCESS_SECTIONS)[number];

/** Where a section came from: the repository's file, or the defaults. */
export type SectionSource = 'repository' | 'default';

/** The process a repository has when it has no file. It is today's behavior, written in one place. */
export function defaultProcess(): ProcessConfig {
  return {
    columns: {
      source: 'labels',
      labels: { ...LABEL_FOR_COLUMN },
      board: { Todo: 'Backlog', 'In Progress': 'In progress', Done: 'Verified' },
    },
    evidence: { pullRequest: 'required', closingPullRequest: true, exceptions: true },
    stale: { idleDays: DEFAULT_STALE_DAYS },
  };
}

export const DEFAULT_PROCESS: Readonly<ProcessConfig> = defaultProcess();

export interface ProcessParseResult {
  /** Always present: what was read, with the defaults where a section or field is missing or was ignored. */
  process: ProcessConfig;
  /** For each section, whether it came from the file or is the default. */
  sources: Record<ProcessSection, SectionSource>;
  issues: ValidationIssue[];
}

const isMapping = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

type Add = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) => void;

const isColumn = (name: string): name is KanbanColumn => (KANBAN_COLUMNS as readonly string[]).includes(name);

function readColumns(data: Record<string, unknown>, add: Add): ProcessConfig['columns'] {
  const result = defaultProcess().columns;
  for (const field of Object.keys(data)) if (!['source', 'labels', 'board'].includes(field)) add('warning', 'unknown-field', { field: `columns.${field}` });

  if (data.source !== undefined) {
    if ((COLUMN_SOURCES as readonly unknown[]).includes(data.source)) result.source = data.source as ColumnSource;
    else add('error', 'process-invalid-column-source', { value: String(data.source) });
  }

  if (data.labels !== undefined) {
    if (!isMapping(data.labels)) {
      add('error', 'process-section-not-a-mapping', { section: 'columns.labels' });
    } else {
      // A column that is left out keeps its default label, so a file can change just one.
      for (const [column, label] of Object.entries(data.labels)) {
        if (!isColumn(column)) add('error', 'process-unknown-column', { column });
        else if (!str(label)) add('error', 'process-invalid-label', { column });
        else result.labels[column] = str(label) as string;
      }
      const seen = new Set<string>();
      for (const label of Object.values(result.labels)) {
        if (seen.has(label.toLowerCase())) add('error', 'process-duplicate-label', { label });
        seen.add(label.toLowerCase());
      }
    }
  }

  if (data.board !== undefined) {
    if (!isMapping(data.board)) {
      add('error', 'process-section-not-a-mapping', { section: 'columns.board' });
    } else {
      // A board map that is given replaces the default map as a whole.
      const board: Record<string, KanbanColumn> = {};
      for (const [status, column] of Object.entries(data.board)) {
        const name = typeof column === 'string' ? column.trim() : '';
        if (!status.trim()) add('error', 'process-invalid-board-entry', { status });
        else if (!isColumn(name)) add('error', 'process-unknown-column', { column: String(column) });
        else board[status.trim()] = name;
      }
      result.board = board;
    }
  }
  return result;
}

function readEvidence(data: Record<string, unknown>, add: Add): ProcessConfig['evidence'] {
  const result = defaultProcess().evidence;
  for (const field of Object.keys(data)) if (!['pull-request', 'closing-pull-request', 'exceptions'].includes(field)) add('warning', 'unknown-field', { field: `evidence.${field}` });

  if (data['pull-request'] !== undefined) {
    if ((PULL_REQUEST_EXPECTATIONS as readonly unknown[]).includes(data['pull-request'])) result.pullRequest = data['pull-request'] as PullRequestExpectation;
    else add('error', 'process-invalid-evidence-value', { field: 'pull-request', value: String(data['pull-request']) });
  }
  for (const [field, key] of [['closing-pull-request', 'closingPullRequest'], ['exceptions', 'exceptions']] as const) {
    if (data[field] === undefined) continue;
    if (typeof data[field] === 'boolean') result[key] = data[field] as boolean;
    else add('error', 'process-invalid-evidence-value', { field, value: String(data[field]) });
  }
  return result;
}

function readStale(data: Record<string, unknown>, add: Add): ProcessConfig['stale'] {
  const result = defaultProcess().stale;
  for (const field of Object.keys(data)) if (field !== 'idle-days') add('warning', 'unknown-field', { field: `stale.${field}` });
  const days = data['idle-days'];
  if (days !== undefined) {
    if (typeof days === 'number' && Number.isInteger(days) && days >= 1) result.idleDays = days;
    else add('error', 'process-invalid-idle-days', { value: String(days) });
  }
  return result;
}

/**
 * Reads a repository's `.weaver/process.yaml` (DEC-015). It always gives a process: a missing
 * section or field keeps today's behavior, so a team can adopt one part at a time. Each section is
 * judged alone: a section with an error is reported and ignored (it keeps its defaults) while the
 * others apply. A file that is not valid YAML, or is of a version this does not know, is reported
 * and ignored as a whole. An empty file means "all defaults". `sources` says which sections the
 * file really set.
 */
export function parseProcess(path: string, text: string): ProcessParseResult {
  const issues: ValidationIssue[] = [];
  const report = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) => issues.push({ severity, code, ...(args ? { args } : {}), path });
  const allDefault = (): ProcessParseResult => ({ process: defaultProcess(), sources: { columns: 'default', evidence: 'default', stale: 'default' }, issues });

  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    report('error', 'process-invalid-yaml', { detail: (error as Error).message });
    return allDefault();
  }
  if (data === null || data === undefined) return allDefault();
  if (!isMapping(data)) {
    report('error', 'process-not-a-mapping');
    return allDefault();
  }
  if (data.version !== undefined && data.version !== 1) {
    report('error', 'process-unsupported-version', { version: String(data.version) });
    return allDefault();
  }
  for (const field of Object.keys(data)) if (field !== 'version' && !(PROCESS_SECTIONS as readonly string[]).includes(field)) report('warning', 'unknown-field', { field });

  const process = defaultProcess();
  const sources: Record<ProcessSection, SectionSource> = { columns: 'default', evidence: 'default', stale: 'default' };
  const readers = { columns: readColumns, evidence: readEvidence, stale: readStale } as const;

  for (const section of PROCESS_SECTIONS) {
    const value = data[section];
    if (value === undefined || value === null) continue;
    if (!isMapping(value)) {
      report('error', 'process-section-not-a-mapping', { section });
      report('warning', 'process-section-ignored', { section });
      continue;
    }
    const found: ValidationIssue[] = [];
    const result = readers[section](value, (severity, code, args) => found.push({ severity, code, ...(args ? { args } : {}), path }));
    issues.push(...found);
    if (found.some((issue) => issue.severity === 'error')) {
      report('warning', 'process-section-ignored', { section });
    } else {
      (process as unknown as Record<string, unknown>)[section] = result;
      sources[section] = 'repository';
    }
  }
  return { process, sources, issues };
}
