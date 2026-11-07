import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { makeRepositoryList, originOfGitConfig, readRepositoryList, type RepositoryList } from '@palab/weaver-markdown';
import { userConfigPath } from './userConfig';

/** `repositories.json` next to the personal configuration, never inside a repository (DEC-018 item 12). */
function listFile(): string {
  return path.join(path.dirname(userConfigPath()), 'repositories.json');
}

const keyOf = (project: { owner: string; number: number }): string => `${project.owner.toLowerCase()}/${project.number}`;

async function readAll(): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(listFile(), 'utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The saved repository list of a Project, when there is a sound one. */
export async function readSavedRepositoryList(project: { owner: string; number: number }): Promise<RepositoryList | undefined> {
  return readRepositoryList((await readAll())[keyOf(project)], project);
}

/**
 * Saves the repositories the Project has cards of, with the time they were read. One entry per Project;
 * the others stay. A failure to save is not an error for the person: the list is a convenience.
 */
export async function saveRepositoryList(project: { owner: string; number: number }, cardRepositories: Iterable<string>, now: Date = new Date()): Promise<RepositoryList | undefined> {
  const list = makeRepositoryList(project, cardRepositories, now);
  try {
    const all = await readAll();
    all[keyOf(project)] = list;
    await fs.mkdir(path.dirname(listFile()), { recursive: true });
    await fs.writeFile(listFile(), `${JSON.stringify(all, null, 2)}\n`, 'utf8');
    return list;
  } catch {
    return undefined;
  }
}

/**
 * The repositories cloned one level below `root`: each folder whose `.git/config` names a GitHub `origin`.
 * A folder that cannot be read, or has no such remote, is skipped.
 */
export async function scanClones(root: string): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const repository = originOfGitConfig(await fs.readFile(path.join(root, entry.name, '.git', 'config'), 'utf8'));
      if (repository) found.push(repository);
    } catch {
      // Not a clone, or not readable: nothing to show for it.
    }
  }
  return found.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}
