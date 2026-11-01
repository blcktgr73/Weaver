import type { Notice } from '@palab/weaver-markdown';
import type { FetchFn } from './issue';
import { fetchProcessFile } from './processFile';

/** Runs `work` on every item, at most `limit` at a time, and returns the results in the order of the items. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/** At most this many repositories are asked at a time (DEC-015). */
export const PROCESS_READ_LIMIT = 4;

/** What a host keeps of a repository's process file between runs: the text and the ETag it came with. */
export interface ProcessCacheEntry {
  text: string;
  etag?: string;
  /** The repository had no file when it was last asked. */
  missing?: true;
}

export interface ProcessRefresh {
  repository: string;
  /** What to keep for the repository: the new answer, or the old one when nothing new could be learned. */
  entry?: ProcessCacheEntry;
  /** The text differs from what was kept (or nothing was kept), so what is shown may change. */
  changed: boolean;
  /** Why the file could not be asked. The old entry, if any, is still good. */
  error?: Notice;
}

/**
 * Asks each repository whether its process file changed since the cached copy, a few at a time. A
 * file that did not change costs almost nothing (the ETag answers 304). A repository that cannot
 * be asked keeps what it had and is reported, so one failure never hides the others.
 */
export async function refreshProcessFiles(
  token: string,
  repositories: readonly string[],
  cached: (repository: string) => ProcessCacheEntry | undefined,
  fetchFn?: FetchFn,
): Promise<ProcessRefresh[]> {
  return mapLimit(repositories, PROCESS_READ_LIMIT, async (repository): Promise<ProcessRefresh> => {
    const before = cached(repository);
    const result = await fetchProcessFile(token, repository, { etag: before?.etag }, fetchFn);
    switch (result.status) {
      case 'unchanged':
        return { repository, entry: before, changed: false };
      case 'missing':
        return { repository, entry: { text: '', missing: true }, changed: before === undefined || !before.missing };
      case 'read':
        return {
          repository,
          entry: { text: result.text, ...(result.etag ? { etag: result.etag } : {}) },
          changed: before === undefined || before.missing === true || before.text !== result.text,
        };
      default:
        return { repository, entry: before, changed: false, error: result.error };
    }
  });
}
