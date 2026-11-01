import { parse as parseYaml } from 'yaml';
import type { MessageArgs } from './i18n';
import type { ValidationIssue } from './types';

/** The central GitHub Project of a fabric. `owner` is a user or an organization login (DEC-007). */
export interface FabricProject {
  owner: string;
  number: number;
}

export interface FabricRepository {
  /** `owner/name`. */
  repository: string;
  /** Optional label for the lane; the repository name is used when absent. */
  title?: string;
}

/** The shared list of registered repositories and the Project they report to (DEC-010). */
export interface FabricRegistry {
  project: FabricProject;
  repositories: FabricRepository[];
}

export interface FabricParseResult {
  /** Present only when the file has no errors. Warnings do not hide it. */
  registry?: FabricRegistry;
  issues: ValidationIssue[];
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const KNOWN_FIELDS = ['project', 'repositories'];
const KNOWN_PROJECT_FIELDS = ['owner', 'number'];
const KNOWN_REPOSITORY_FIELDS = ['repository', 'title'];

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Reads `fabric.yaml`. The file is plain YAML, not Markdown with frontmatter.
 * `path` is only used to label the issues; the parser does not care where the file lives.
 * A repository entry is `owner/name` or `{ repository, title? }`.
 */
export function parseFabric(path: string, text: string): FabricParseResult {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) =>
    issues.push({ severity, code, ...(args ? { args } : {}), path });

  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    add('error', 'fabric-invalid-yaml', { detail: (error as Error).message });
    return { issues };
  }
  if (!isMapping(data)) {
    add('error', 'fabric-not-a-mapping');
    return { issues };
  }

  for (const field of Object.keys(data)) {
    if (!KNOWN_FIELDS.includes(field)) add('warning', 'unknown-field', { field });
  }

  const project = readFabricProject(data.project, add);
  const repositories = readFabricRepositories(data.repositories, add);

  if (issues.some((issue) => issue.severity === 'error') || !project) return { issues };
  return { registry: { project, repositories }, issues };
}

type Add = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) => void;

/** Reads a `project` entry; shared with the personal configuration. */
export function readFabricProject(value: unknown, add: Add): FabricProject | undefined {
  if (value === undefined || value === null) {
    add('error', 'missing-field', { field: 'project' });
    return undefined;
  }
  if (!isMapping(value)) {
    add('error', 'fabric-project-not-a-mapping');
    return undefined;
  }
  for (const field of Object.keys(value)) {
    if (!KNOWN_PROJECT_FIELDS.includes(field)) add('warning', 'unknown-field', { field: `project.${field}` });
  }

  let ok = true;
  const owner = str(value.owner);
  if (!owner) {
    add('error', 'missing-field', { field: 'project.owner' });
    ok = false;
  } else if (!OWNER.test(owner)) {
    add('error', 'fabric-invalid-project-owner', { owner });
    ok = false;
  }

  const number = value.number;
  if (number === undefined || number === null) {
    add('error', 'missing-field', { field: 'project.number' });
    ok = false;
  } else if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
    add('error', 'fabric-invalid-project-number', { number: String(number) });
    ok = false;
  }
  return ok ? { owner: owner as string, number: number as number } : undefined;
}

/** Reads a `repositories` list; shared with the personal configuration. */
export function readFabricRepositories(value: unknown, add: Add): FabricRepository[] {
  if (value === undefined || value === null) {
    add('error', 'missing-field', { field: 'repositories' });
    return [];
  }
  if (!Array.isArray(value)) {
    add('error', 'fabric-repositories-not-a-list');
    return [];
  }
  if (value.length === 0) {
    add('error', 'fabric-no-repositories');
    return [];
  }

  const repositories: FabricRepository[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const repository = isMapping(entry) ? str(entry.repository) : str(entry);
    if (isMapping(entry)) {
      for (const field of Object.keys(entry)) {
        if (!KNOWN_REPOSITORY_FIELDS.includes(field)) add('warning', 'unknown-field', { field: `repositories.${field}` });
      }
    }
    if (!repository) {
      add('error', 'fabric-invalid-repository-entry');
      continue;
    }
    if (!REPOSITORY.test(repository)) {
      add('error', 'invalid-repository', { repository });
      continue;
    }
    // GitHub names are case-insensitive, so the same repository may not be listed twice.
    const key = repository.toLowerCase();
    if (seen.has(key)) {
      add('error', 'fabric-duplicate-repository', { repository });
      continue;
    }
    seen.add(key);
    const title = isMapping(entry) ? str(entry.title) : undefined;
    repositories.push(title ? { repository, title } : { repository });
  }
  return repositories;
}
