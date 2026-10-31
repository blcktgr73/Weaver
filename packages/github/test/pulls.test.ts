import { describe, expect, it } from 'vitest';
import { readMergedPulls, type Fetch } from '../src';

const reply = (body: unknown, status = 200): Fetch => async () => ({ ok: status < 400, status, json: async () => body });

const node = (number: number, closes: number[]) => ({
  number,
  title: `PR ${number}`,
  url: `https://github.com/o/a/pull/${number}`,
  headRefName: `feat/task-0${number}-x`,
  closingIssuesReferences: { nodes: closes.map((n) => ({ number: n })) },
});

describe('readMergedPulls', () => {
  it('returns the pull requests with the Issues each one closes', async () => {
    const result = await readMergedPulls('t', 'o/a', 50, reply({ data: { repository: { pullRequests: { nodes: [node(80, [65]), node(79, [])] } } } }));
    expect(result).toEqual({
      ok: true,
      pulls: [
        { repository: 'o/a', number: 80, title: 'PR 80', url: 'https://github.com/o/a/pull/80', branch: 'feat/task-080-x', closes: [65] },
        { repository: 'o/a', number: 79, title: 'PR 79', url: 'https://github.com/o/a/pull/79', branch: 'feat/task-079-x', closes: [] },
      ],
    });
  });

  it('asks for the owner, the name, and the limit', async () => {
    let variables: unknown;
    const spy: Fetch = async (_url, init) => {
      variables = JSON.parse(init.body).variables;
      return { ok: true, status: 200, json: async () => ({ data: { repository: { pullRequests: { nodes: [] } } } }) };
    };
    await readMergedPulls('t', 'me/repo', 20, spy);
    expect(variables).toEqual({ o: 'me', r: 'repo', n: 20 });
  });

  it('returns one notice naming the repository for every failure, and never throws', async () => {
    const down: Fetch = async () => {
      throw new Error('offline');
    };
    for (const fetchImpl of [
      reply({}, 502),
      reply({ errors: [{ message: 'x' }] }),
      reply({ data: { repository: null } }),
      down,
      reply(null),
    ]) {
      expect(await readMergedPulls('t', 'o/a', 50, fetchImpl)).toEqual({ ok: false, error: { code: 'pulls.failed', args: { repository: 'o/a' } } });
    }
    expect((await readMergedPulls('t', 'not-a-repo', 50, reply({}))).ok).toBe(false);
  });
});
