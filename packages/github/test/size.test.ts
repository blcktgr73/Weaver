import { describe, expect, it } from 'vitest';
import { readRepositorySizes, type Fetch } from '../src';

const reply = (body: unknown): Fetch => async () => ({ ok: true, status: 200, json: async () => body });

describe('readRepositorySizes', () => {
  it('returns the size of each repository that could be read', async () => {
    const sizes = await readRepositorySizes('t', ['o/a', 'o/b', 'o/gone'], reply({ data: { r0: { diskUsage: 120 }, r1: { diskUsage: 2048 }, r2: null } }));
    expect(Object.fromEntries(sizes)).toEqual({ 'o/a': 120, 'o/b': 2048 });
  });

  it('sends owner and name as variables, not in the query text', async () => {
    let sent: { query: string; variables: Record<string, string> } | undefined;
    const spy: Fetch = async (_url, init) => {
      sent = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ data: {} }) };
    };
    await readRepositorySizes('t', ['o/a"){x}'], spy);
    expect(sent?.variables).toEqual({ o0: 'o', n0: 'a"){x}' });
    expect(sent?.query).not.toContain('a"){x}');
  });

  it('returns no sizes when the call fails', async () => {
    const broken: Fetch = async () => {
      throw new Error('offline');
    };
    expect((await readRepositorySizes('t', ['o/a'], broken)).size).toBe(0);
  });
});
