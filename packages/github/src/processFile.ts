import type { Notice } from '@palab/weaver-markdown';
import type { FetchFn } from './issue';

/** Where a repository keeps its process (DEC-015). */
export const PROCESS_FILE = '.weaver/process.yaml';

export type ProcessFileResult =
  /** The file is as it was when `etag` was taken; nothing was sent. */
  | { status: 'unchanged' }
  /** The repository has no process file (or this sign-in cannot see it). Its defaults apply. */
  | { status: 'missing' }
  | { status: 'read'; text: string; etag?: string }
  | { status: 'failed'; error: Notice };

const API = 'https://api.github.com';

/**
 * Reads the process file of a repository. Pass the `etag` of the text you already have, and GitHub
 * answers "unchanged" without sending it again, at almost no cost against the rate limit. A
 * repository without the file is a normal answer (`missing`), not an error; any other failure
 * comes back as a notice so that one repository cannot stop the others from being read.
 */
export async function fetchProcessFile(
  token: string,
  repository: string,
  options: { etag?: string } = {},
  fetchFn: FetchFn = fetch,
): Promise<ProcessFileResult> {
  let response;
  try {
    response = await fetchFn(`${API}/repos/${repository}/contents/${PROCESS_FILE}`, {
      headers: {
        Accept: 'application/vnd.github.raw+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.etag ? { 'If-None-Match': options.etag } : {}),
      },
    });
  } catch (error) {
    return { status: 'failed', error: { code: 'github.err.network', args: { detail: (error as Error).message } } };
  }
  if (response.status === 304) return { status: 'unchanged' };
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) return { status: 'failed', error: { code: 'github.err.http', args: { status: response.status } } };
  try {
    const etag = response.headers.get('etag') ?? undefined;
    return { status: 'read', text: await response.text(), ...(etag ? { etag } : {}) };
  } catch (error) {
    return { status: 'failed', error: { code: 'github.err.network', args: { detail: (error as Error).message } } };
  }
}
