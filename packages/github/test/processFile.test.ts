import { describe, expect, it } from 'vitest';
import { fetchProcessFile, PROCESS_FILE, type FetchFn } from '../src';

type Call = { url: string; headers: Record<string, string> };

function answer(status: number, options: { text?: string; etag?: string; textFails?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? options.etag ?? null : null) },
      text: async () => {
        if (options.textFails) throw new Error('connection reset');
        return options.text ?? '';
      },
    };
  }) as unknown as FetchFn;
  return { fetchFn, calls };
}

describe('fetchProcessFile', () => {
  it('asks for the file of the repository as raw text, with the token', async () => {
    const { fetchFn, calls } = answer(200, { text: 'version: 1\n', etag: '"abc"' });
    const result = await fetchProcessFile('secret', 'me/Weaver', {}, fetchFn);
    expect(result).toEqual({ status: 'read', text: 'version: 1\n', etag: '"abc"' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://api.github.com/repos/me/Weaver/contents/${PROCESS_FILE}`);
    expect(calls[0].headers.Authorization).toBe('Bearer secret');
    expect(calls[0].headers.Accept).toBe('application/vnd.github.raw+json');
    expect(calls[0].headers['If-None-Match']).toBeUndefined();
  });

  it('sends the ETag it already has, and says unchanged when GitHub answers 304', async () => {
    const { fetchFn, calls } = answer(304);
    expect(await fetchProcessFile('t', 'me/a', { etag: '"abc"' }, fetchFn)).toEqual({ status: 'unchanged' });
    expect(calls[0].headers['If-None-Match']).toBe('"abc"');
  });

  it('treats a repository without the file as a normal answer', async () => {
    expect(await fetchProcessFile('t', 'me/a', {}, answer(404).fetchFn)).toEqual({ status: 'missing' });
  });

  it('reads a file that comes without an ETag', async () => {
    expect(await fetchProcessFile('t', 'me/a', {}, answer(200, { text: 'x' }).fetchFn)).toEqual({ status: 'read', text: 'x' });
  });

  it('turns every other failure into a notice instead of throwing', async () => {
    expect(await fetchProcessFile('t', 'me/a', {}, answer(403).fetchFn)).toEqual({ status: 'failed', error: { code: 'github.err.http', args: { status: 403 } } });
    expect(await fetchProcessFile('t', 'me/a', {}, answer(500).fetchFn)).toMatchObject({ status: 'failed', error: { code: 'github.err.http' } });
    const offline = (async () => {
      throw new Error('offline');
    }) as unknown as FetchFn;
    expect(await fetchProcessFile('t', 'me/a', {}, offline)).toEqual({ status: 'failed', error: { code: 'github.err.network', args: { detail: 'offline' } } });
    expect(await fetchProcessFile('t', 'me/a', {}, answer(200, { textFails: true }).fetchFn)).toMatchObject({ status: 'failed', error: { code: 'github.err.network' } });
  });
});
