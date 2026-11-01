import { describe, expect, it } from 'vitest';
import { PROCESS_READ_LIMIT, refreshProcessFiles, type FetchFn, type ProcessCacheEntry } from '../src';

type Answer = { status: number; text?: string; etag?: string } | 'offline';

/** GitHub's answer for the process file of each repository, and the headers each ask carried. */
function contents(files: Record<string, Answer>) {
  const asked: { repository: string; ifNoneMatch?: string }[] = [];
  let inFlight = 0;
  let peak = 0;
  const fetchFn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    const repository = /\/repos\/([^/]+\/[^/]+)\/contents\//.exec(url)?.[1] ?? '';
    asked.push({ repository, ifNoneMatch: init?.headers?.['If-None-Match'] });
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 3));
    inFlight -= 1;
    const file = files[repository] ?? { status: 404 };
    if (file === 'offline') throw new Error('offline');
    return { ok: file.status === 200, status: file.status, headers: { get: (n: string) => (n.toLowerCase() === 'etag' ? file.etag ?? null : null) }, text: async () => file.text ?? '' };
  }) as unknown as FetchFn;
  return { fetchFn, asked, peak: () => peak };
}

const cache = (entries: Record<string, ProcessCacheEntry>) => (repository: string) => entries[repository];

describe('refreshProcessFiles', () => {
  it('keeps the new file and says it is new when the repository was never asked', async () => {
    const { fetchFn } = contents({ 'me/a': { status: 200, text: 'stale: {idle-days: 3}\n', etag: '"1"' }, 'me/b': { status: 404 } });
    const [a, b] = await refreshProcessFiles('t', ['me/a', 'me/b'], cache({}), fetchFn);
    expect(a).toEqual({ repository: 'me/a', entry: { text: 'stale: {idle-days: 3}\n', etag: '"1"' }, changed: true });
    expect(b).toEqual({ repository: 'me/b', entry: { text: '', missing: true }, changed: true });
  });

  it('sends the ETag it has, and keeps the old text without calling it a change when GitHub says 304', async () => {
    const { fetchFn, asked } = contents({ 'me/a': { status: 304 } });
    const before = { text: 'x: 1\n', etag: '"1"' };
    const [a] = await refreshProcessFiles('t', ['me/a'], cache({ 'me/a': before }), fetchFn);
    expect(asked[0].ifNoneMatch).toBe('"1"');
    expect(a).toEqual({ repository: 'me/a', entry: before, changed: false });
  });

  it('is a change only when the text differs, a file appears, or a file goes away', async () => {
    const { fetchFn } = contents({ 'me/same': { status: 200, text: 'x: 1\n', etag: '"2"' }, 'me/edited': { status: 200, text: 'x: 2\n' }, 'me/new': { status: 200, text: 'x: 1\n' }, 'me/gone': { status: 404 } });
    const result = await refreshProcessFiles(
      't',
      ['me/same', 'me/edited', 'me/new', 'me/gone'],
      cache({ 'me/same': { text: 'x: 1\n' }, 'me/edited': { text: 'x: 1\n' }, 'me/new': { text: '', missing: true }, 'me/gone': { text: 'x: 1\n' } }),
      fetchFn,
    );
    expect(result.map((r) => r.changed)).toEqual([false, true, true, true]);
  });

  it('keeps a repository without a file as a normal answer that is not a change the second time', async () => {
    const { fetchFn } = contents({});
    const [a] = await refreshProcessFiles('t', ['me/a'], cache({ 'me/a': { text: '', missing: true } }), fetchFn);
    expect(a.changed).toBe(false);
  });

  it('keeps what it had and says why when a repository cannot be asked, without stopping the others', async () => {
    const { fetchFn } = contents({ 'me/a': 'offline', 'me/b': { status: 403 }, 'me/c': { status: 200, text: 'y: 1\n' } });
    const kept = { text: 'x: 1\n', etag: '"1"' };
    const [a, b, c] = await refreshProcessFiles('t', ['me/a', 'me/b', 'me/c'], cache({ 'me/a': kept }), fetchFn);
    expect(a).toMatchObject({ entry: kept, changed: false, error: { code: 'github.err.network' } });
    expect(b).toMatchObject({ entry: undefined, changed: false, error: { code: 'github.err.http' } });
    expect(c.changed).toBe(true);
  });

  it('asks at most four at a time', async () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => `me/${n}`);
    const { fetchFn, peak, asked } = contents({});
    await refreshProcessFiles('t', names, cache({}), fetchFn);
    expect(peak()).toBeLessThanOrEqual(PROCESS_READ_LIMIT);
    expect(peak()).toBeGreaterThan(1);
    expect(asked.map((a) => a.repository).sort()).toEqual(names);
  });
});
