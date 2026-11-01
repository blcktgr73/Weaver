import { describe, expect, it } from 'vitest';
import { defaultProcess } from '@palab/weaver-markdown';
import type { Fetch, FetchFn } from '@palab/weaver-github';
import { EXIT, mapLimit, PROCESS_READ_LIMIT, processText, readProcesses, run } from '../src';
import { setup } from './helpers';

/** GitHub's answer for the process file of each repository; any other repository has none. */
function contents(files: Record<string, { status: number; text?: string; etag?: string } | 'offline'>, trace: { inFlight: number; peak: number; asked: string[] } = { inFlight: 0, peak: 0, asked: [] }) {
  const fetchFn = (async (url: string) => {
    const repository = /\/repos\/([^/]+\/[^/]+)\/contents\//.exec(url)?.[1] ?? '';
    trace.asked.push(repository);
    trace.inFlight += 1;
    trace.peak = Math.max(trace.peak, trace.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    trace.inFlight -= 1;
    const file = files[repository];
    if (file === 'offline') throw new Error('offline');
    const { status, text, etag } = file ?? { status: 404 };
    return { ok: status === 200, status, headers: { get: (name: string) => (name === 'etag' ? etag ?? null : null) }, text: async () => text ?? '' };
  }) as unknown as FetchFn;
  return { fetchFn, trace };
}

describe('mapLimit', () => {
  it('keeps the order of the items and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const result = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 3 * (8 - n)));
      running -= 1;
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBe(3);
  });

  it('copes with no items, and with a limit larger than the list', async () => {
    expect(await mapLimit([], 4, async (n: number) => n)).toEqual([]);
    expect(await mapLimit([1, 2], 10, async (n) => n + 1)).toEqual([2, 3]);
    expect(await mapLimit([1, 2], 0, async (n) => n + 1)).toEqual([2, 3]);
  });
});

describe('readProcesses', () => {
  const repositories = ['me/a', 'me/b', 'me/c', 'me/d', 'me/e', 'me/f'];

  it('reads each repository, asks at most four at a time, and answers in the order given', async () => {
    const { fetchFn, trace } = contents({ 'me/a': { status: 200, text: 'columns:\n  source: board-status\n' } });
    const reports = await readProcesses('t', repositories, 'en', fetchFn);
    expect(reports.map((r) => r.repository)).toEqual(repositories);
    expect(trace.peak).toBeLessThanOrEqual(PROCESS_READ_LIMIT);
    expect(trace.peak).toBeGreaterThan(1);
    expect(trace.asked.sort()).toEqual(repositories);
  });

  it('shows what the file sets, and the defaults for a repository without one', async () => {
    const { fetchFn } = contents({ 'me/a': { status: 200, text: 'version: 1\ncolumns:\n  source: board-status\nevidence:\n  pull-request: optional\n', etag: '"x"' } });
    const [a, b] = await readProcesses('t', ['me/a', 'me/b'], 'en', fetchFn);
    expect(a).toMatchObject({ repository: 'me/a', file: 'read', sources: { columns: 'repository', evidence: 'repository', stale: 'default' }, issues: [] });
    expect(a.process.columns.source).toBe('board-status');
    expect(a.process.evidence.pullRequest).toBe('optional');
    expect(b).toMatchObject({ file: 'missing', sources: { columns: 'default', evidence: 'default', stale: 'default' }, issues: [] });
    expect(b.process).toEqual(defaultProcess());
  });

  it('reports a wrong section in the chosen language and keeps the other sections', async () => {
    const text = 'columns:\n  source: magic\nstale:\n  idle-days: 7\n';
    const { fetchFn } = contents({ 'me/a': { status: 200, text } });
    const [en] = await readProcesses('t', ['me/a'], 'en', fetchFn);
    expect(en.sources).toEqual({ columns: 'default', evidence: 'default', stale: 'repository' });
    expect(en.process.stale.idleDays).toBe(7);
    expect(en.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(['error:process-invalid-column-source', 'warning:process-section-ignored']);
    expect(en.issues[0].message).toContain('"labels" or "board-status"');
    const [ko] = await readProcesses('t', ['me/a'], 'ko', fetchFn);
    expect(ko.issues[0].message).toContain('여야 합니다');
  });

  it('shows the defaults and the reason when a repository cannot be read, without stopping the others', async () => {
    const { fetchFn } = contents({ 'me/a': { status: 403 }, 'me/b': 'offline', 'me/c': { status: 200, text: 'stale:\n  idle-days: 3\n' } });
    const [a, b, c] = await readProcesses('t', ['me/a', 'me/b', 'me/c'], 'en', fetchFn);
    expect(a).toMatchObject({ file: 'failed', error: { code: 'github.err.http' } });
    expect(a.process).toEqual(defaultProcess());
    expect(b).toMatchObject({ file: 'failed', error: { code: 'github.err.network' } });
    expect(c).toMatchObject({ file: 'read', sources: { stale: 'repository' } });
  });
});

describe('processText', () => {
  it('prints a line per repository with where each section comes from, and its problems', async () => {
    const { fetchFn } = contents({ 'me/a': { status: 200, text: 'stale:\n  idle-days: 0\n' }, 'me/b': { status: 403 } });
    const text = processText(await readProcesses('t', ['me/a', 'me/b', 'me/c'], 'en', fetchFn));
    expect(text).toContain('me/a\tread\tcolumns=default evidence=default stale=default');
    expect(text).toContain('  error: ');
    expect(text).toContain('me/b\tfailed\t');
    expect(text).toContain('me/c\tmissing\t');
    expect(processText([])).toBe('');
  });
});

describe('weaver process', () => {
  function withContents(files: Parameters<typeof contents>[0]) {
    const s = setup();
    const { fetchFn } = contents(files);
    const original = s.deps.fetch as Fetch;
    s.deps.fetch = (async (url: string, init: never) => (url.includes('/contents/') ? (fetchFn as unknown as (u: string) => unknown)(url) : original(url, init))) as unknown as Fetch;
    return s;
  }

  it('prints how each repository of the Project tracks its work, as JSON with a schema', async () => {
    const { deps, out } = withContents({ 'me/Weaver': { status: 200, text: 'columns:\n  source: board-status\n' } });
    expect(await run(['process'], deps)).toBe(EXIT.ok);
    const result = JSON.parse(out.join(''));
    expect(result.schema).toBe(1);
    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0]).toMatchObject({ repository: 'me/Weaver', file: 'read', sources: { columns: 'repository' } });
    expect(result.repositories[0].process.columns.source).toBe('board-status');
  });

  it('says that a repository without the file uses the defaults', async () => {
    const { deps, out } = withContents({});
    await run(['process', '--text'], deps);
    expect(out.join('')).toBe('me/Weaver\tmissing\tcolumns=default evidence=default stale=default\n');
  });

  it('can be limited to one repository, and then finds nothing for one that is not there', async () => {
    const { deps, out } = withContents({});
    await run(['process', '--repository', 'ME/WEAVER', '--text'], deps);
    expect(out.join('')).toContain('me/Weaver\tmissing');
    const other = withContents({});
    await run(['process', '--repository', 'me/other'], other.deps);
    expect(JSON.parse(other.out.join('')).repositories).toEqual([]);
  });
});
