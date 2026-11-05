import { describe, expect, it } from 'vitest';
import { fetchRepositoryFile, refreshRosterFile, rosterCacheKey, type FetchFn, type RosterCacheEntry } from '../src';

type Call = { url: string; headers: Record<string, string> };

function answer(status: number, options: { text?: string; etag?: string; fails?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    if (options.fails) throw new Error('offline');
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? options.etag ?? null : null) },
      text: async () => options.text ?? '',
    };
  }) as unknown as FetchFn;
  return { fetchFn, calls };
}

const ref = { repository: 'My-Org/agents', path: 'rosters/team roster.yaml', ref: 'release/1' };
const NOW = new Date('2026-11-06T10:00:00Z');
const kept = (extra: Partial<RosterCacheEntry> = {}): RosterCacheEntry => ({ text: 'contributors: []\n', etag: '"v1"', readAt: '2026-11-05T10:00:00.000Z', ...extra });

describe('fetchRepositoryFile', () => {
  it('asks for the path at the ref, encoded, with the token', async () => {
    const { fetchFn, calls } = answer(200, { text: 'x', etag: '"e"' });
    expect(await fetchRepositoryFile('tok', ref.repository, ref.path, { ref: ref.ref }, fetchFn)).toEqual({ status: 'read', text: 'x', etag: '"e"' });
    expect(calls[0].url).toBe('https://api.github.com/repos/My-Org/agents/contents/rosters/team%20roster.yaml?ref=release%2F1');
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('reads the default branch when no ref is given', async () => {
    const { fetchFn, calls } = answer(200, { text: 'x' });
    await fetchRepositoryFile('tok', 'o/a', 'roster.yaml', {}, fetchFn);
    expect(calls[0].url).toBe('https://api.github.com/repos/o/a/contents/roster.yaml');
  });
});

describe('refreshRosterFile', () => {
  it('keeps the text with its ETag and the time GitHub said so', async () => {
    const { fetchFn } = answer(200, { text: 'contributors:\n  - {id: a, kind: human}\n', etag: '"v2"' });
    const result = await refreshRosterFile('t', ref, undefined, NOW, fetchFn);
    expect(result).toEqual({ entry: { text: 'contributors:\n  - {id: a, kind: human}\n', etag: '"v2"', readAt: NOW.toISOString() }, changed: true });
  });

  it('sends the ETag, and on 304 keeps the text and renews the age', async () => {
    const { fetchFn, calls } = answer(304);
    const result = await refreshRosterFile('t', ref, kept(), NOW, fetchFn);
    expect(calls[0].headers['If-None-Match']).toBe('"v1"');
    expect(result).toEqual({ entry: kept({ readAt: NOW.toISOString() }), changed: false });
  });

  it('reports a changed text, and an unchanged one read again as not changed', async () => {
    expect((await refreshRosterFile('t', ref, kept(), NOW, answer(200, { text: 'other' }).fetchFn)).changed).toBe(true);
    expect((await refreshRosterFile('t', ref, kept(), NOW, answer(200, { text: 'contributors: []\n' }).fetchFn)).changed).toBe(false);
  });

  it('works offline: a failure keeps the old copy and its old age, and says why', async () => {
    const result = await refreshRosterFile('t', ref, kept(), NOW, answer(0, { fails: true }).fetchFn);
    expect(result.entry).toEqual(kept());
    expect(result.changed).toBe(false);
    expect(result.error?.code).toBe('github.err.network');
    expect((await refreshRosterFile('t', ref, undefined, NOW, answer(500).fetchFn)).entry).toBeUndefined();
  });

  it('remembers that the file is not there, and does not call that a change twice', async () => {
    const first = await refreshRosterFile('t', ref, kept(), NOW, answer(404).fetchFn);
    expect(first).toEqual({ entry: { text: '', missing: true, readAt: NOW.toISOString() }, changed: true });
    expect((await refreshRosterFile('t', ref, first.entry, NOW, answer(404).fetchFn)).changed).toBe(false);
  });
});

describe('rosterCacheKey', () => {
  it('ignores the case of the repository and tells paths and refs apart', () => {
    expect(rosterCacheKey({ repository: 'A/b', path: 'r.yaml' })).toBe(rosterCacheKey({ repository: 'a/B', path: 'r.yaml' }));
    expect(rosterCacheKey({ repository: 'a/b', path: 'r.yaml', ref: 'x' })).not.toBe(rosterCacheKey({ repository: 'a/b', path: 'r.yaml' }));
  });
});
