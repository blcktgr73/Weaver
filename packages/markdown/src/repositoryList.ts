/**
 * Repositories that are on this computer or on the Project, and the saved list of the ones the Project has
 * cards of (DEC-018 items 11 and 12). Nothing here reads a file or the network.
 */

/** `owner/name` of a GitHub address: `https://github.com/o/n(.git)`, `git@github.com:o/n(.git)`, or `ssh://git@github.com/o/n`. */
export function repositoryOfRemote(url: string): string | undefined {
  const match = /^(?:https?:\/\/(?:[^@/\s]+@)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** The repository the `origin` remote of a `.git/config` text names, or nothing when there is none or it is not on GitHub. */
export function originOfGitConfig(text: string): string | undefined {
  let inOrigin = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inOrigin = /^\[remote\s+"origin"\]$/i.test(line);
      continue;
    }
    if (!inOrigin) continue;
    const url = /^url\s*=\s*(.+)$/i.exec(line);
    if (url) return repositoryOfRemote(url[1]);
  }
  return undefined;
}

/**
 * Clones that deserve a lane of their own: not named in the list already, and with no card on the Project,
 * so they would otherwise be missing without a word (DEC-018 item 11). A clone that has cards is shown or
 * left out by the list like any repository. Order and spelling of the first mention are kept.
 */
export function clonesWithoutCards(clones: readonly string[], listed: readonly string[], cardRepositories: Iterable<string>): string[] {
  const skip = new Set(listed.map((name) => name.toLowerCase()));
  for (const name of cardRepositories) skip.add(name.toLowerCase());
  const found: string[] = [];
  for (const name of clones) {
    if (skip.has(name.toLowerCase())) continue;
    skip.add(name.toLowerCase());
    found.push(name);
  }
  return found;
}

/** How long a saved repository list is fresh (DEC-018 item 12). */
export const REPOSITORY_LIST_FRESH_HOURS = 24;

/** The repositories a Project has cards of, saved with the time they were read, on the person's computer only. */
export interface RepositoryList {
  version: 1;
  project: { owner: string; number: number };
  /** When the read finished, as an ISO date. */
  readAt: string;
  repositories: { name: string; cards: number }[];
}

/** The list for a Project from the names of the repositories of its cards, one entry per repository, spelled as first seen. */
export function makeRepositoryList(project: { owner: string; number: number }, cardRepositories: Iterable<string>, now: Date): RepositoryList {
  const counts = new Map<string, { name: string; cards: number }>();
  for (const name of cardRepositories) {
    const key = name.toLowerCase();
    const row = counts.get(key);
    if (row) row.cards += 1;
    else counts.set(key, { name, cards: 1 });
  }
  const repositories = [...counts.values()].sort((a, b) => b.cards - a.cards || a.name.localeCompare(b.name));
  return { version: 1, project: { owner: project.owner, number: project.number }, readAt: now.toISOString(), repositories };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The saved list when it can be trusted: the same Project, a valid date, and well-formed rows. Anything else is ignored. */
export function readRepositoryList(raw: unknown, project: { owner: string; number: number }): RepositoryList | undefined {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.project)) return undefined;
  if (typeof raw.project.owner !== 'string' || raw.project.owner.toLowerCase() !== project.owner.toLowerCase() || raw.project.number !== project.number) return undefined;
  if (typeof raw.readAt !== 'string' || Number.isNaN(Date.parse(raw.readAt)) || !Array.isArray(raw.repositories)) return undefined;
  const sound = raw.repositories.every((row) => isRecord(row) && typeof row.name === 'string' && row.name.includes('/') && typeof row.cards === 'number');
  return sound ? (raw as unknown as RepositoryList) : undefined;
}

/** True when the saved list is older than the fresh time, so it is read again in the background. */
export function repositoryListIsOld(readAt: string, now: Date, freshHours: number = REPOSITORY_LIST_FRESH_HOURS): boolean {
  return now.getTime() - Date.parse(readAt) > freshHours * 3600 * 1000;
}
