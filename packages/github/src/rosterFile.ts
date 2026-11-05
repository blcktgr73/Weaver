import type { Notice, RosterRef } from '@palab/weaver-markdown';
import { fetchRepositoryFile } from './processFile';
import type { FetchFn } from './issue';

/**
 * What a host keeps of a shared roster file between runs (DEC-017 item 7): the text, the ETag it
 * came with, and when GitHub last confirmed it. It is kept on the person's computer, never in a repository.
 */
export interface RosterCacheEntry {
  text: string;
  etag?: string;
  /** The file was not there when it was last asked. */
  missing?: true;
  /** An ISO time: the last time GitHub said this text is current. The age of the roster is counted from it. */
  readAt: string;
}

export interface RosterRefresh {
  /** What to keep: the new answer, or the old one when nothing new could be learned. */
  entry?: RosterCacheEntry;
  /** The text differs from what was kept (or nothing was kept), so what is shown may change. */
  changed: boolean;
  /** Why the file could not be asked. The old entry, if any, is still good and is used (offline). */
  error?: Notice;
}

/** The key a host keeps an entry under: repository, path, and ref, without regard to case in the repository. */
export function rosterCacheKey(ref: RosterRef): string {
  return `${ref.repository.toLowerCase()}|${ref.path}|${ref.ref ?? ''}`;
}

/**
 * Asks whether the shared roster file changed since the cached copy. An unchanged file costs almost
 * nothing (the ETag answers 304) and renews the age. A file that cannot be asked leaves the old
 * entry as it is, so the roster keeps working offline and its age keeps growing.
 */
export async function refreshRosterFile(
  token: string,
  ref: RosterRef,
  before: RosterCacheEntry | undefined,
  now: Date = new Date(),
  fetchFn?: FetchFn,
): Promise<RosterRefresh> {
  const result = await fetchRepositoryFile(token, ref.repository, ref.path, { etag: before?.etag, ref: ref.ref }, fetchFn);
  const readAt = now.toISOString();
  switch (result.status) {
    case 'unchanged':
      return { entry: before ? { ...before, readAt } : undefined, changed: false };
    case 'missing':
      return { entry: { text: '', missing: true, readAt }, changed: before === undefined || !before.missing };
    case 'read':
      return {
        entry: { text: result.text, ...(result.etag ? { etag: result.etag } : {}), readAt },
        changed: before === undefined || before.missing === true || before.text !== result.text,
      };
    default:
      return { entry: before, changed: false, error: result.error };
  }
}
