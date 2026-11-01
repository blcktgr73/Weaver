import { describe, expect, it } from 'vitest';
import { listProjects, summarizeProject, type Fetch } from '../src';

const answer = (status: number, body: unknown): Fetch => async () => ({ ok: status < 400, status, json: async () => body });
const node = (number: number, title: string, items: number, closed = false) => ({ number, title, closed, items: { totalCount: items } });

describe('listProjects', () => {
  const reply = {
    data: {
      viewer: {
        login: 'me',
        projectsV2: { nodes: [node(1, 'Ops', 108), node(2, 'Old', 3, true)] },
        organizations: { nodes: [{ login: 'team', projectsV2: { nodes: [node(7, 'Roadmap', 40)] } }, { login: 'empty', projectsV2: { nodes: [] } }] },
      },
    },
  };

  it('lists the Projects of the person and of their organizations, leaving out closed ones', async () => {
    const result = await listProjects('t', answer(200, reply));
    expect(result).toEqual({
      ok: true,
      projects: [
        { owner: 'me', number: 1, title: 'Ops', items: 108, closed: false },
        { owner: 'team', number: 7, title: 'Roadmap', items: 40, closed: false },
      ],
    });
  });

  it('sends the token and one query', async () => {
    const calls: { headers: Record<string, string>; body: string }[] = [];
    const fetchImpl: Fetch = async (_url, init) => {
      calls.push({ headers: init.headers, body: init.body });
      return { ok: true, status: 200, json: async () => reply };
    };
    await listProjects('secret', fetchImpl);
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(calls[0].body).query).toContain('projectsV2');
  });

  it('turns each failure into a notice', async () => {
    const code = async (fetchImpl: Fetch) => {
      const result = await listProjects('t', fetchImpl);
      return result.ok ? 'ok' : result.error.code;
    };
    expect(await code(answer(401, {}))).toBe('project.unauthorized');
    expect(await code(answer(200, { errors: [{ type: 'INSUFFICIENT_SCOPES', message: 'needs read:project' }] }))).toBe('project.missing-scope');
    expect(await code(answer(200, { errors: [{ type: 'RATE_LIMITED', message: 'slow down' }] }))).toBe('project.rate-limited');
    expect(await code(answer(403, {}))).toBe('project.forbidden');
    expect(await code(answer(500, {}))).toBe('project.unreachable');
    expect(await code(answer(200, { errors: [{ message: 'boom' }] }))).toBe('project.unreachable');
    expect(await code(async () => {
      throw new Error('offline');
    })).toBe('project.unreachable');
    expect(await code(async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } }))).toBe('project.unreachable');
  });
});

describe('listProjects with a sign-in that cannot see the organizations', () => {
  const own = { data: { viewer: { login: 'me', projectsV2: { nodes: [node(1, 'Ops', 108)] } } } };
  const scopeError = { errors: [{ type: 'INSUFFICIENT_SCOPES', message: "The 'organizations' field requires one of the following scopes: ['read:org']" }] };

  /** Answers the full query with a scope error, and the own-Projects query with `own`. */
  const withoutOrgScope = (calls: string[] = []): Fetch => async (_url, init) => {
    const query = JSON.parse(init.body).query as string;
    calls.push(query.includes('organizations') ? 'full' : 'own');
    const body = query.includes('organizations') ? scopeError : own;
    return { ok: true, status: 200, json: async () => body };
  };

  it('lists the own Projects and says the organizations were skipped, instead of failing', async () => {
    const calls: string[] = [];
    expect(await listProjects('t', withoutOrgScope(calls))).toEqual({
      ok: true,
      organizationsSkipped: true,
      projects: [{ owner: 'me', number: 1, title: 'Ops', items: 108, closed: false }],
    });
    expect(calls).toEqual(['full', 'own']);
  });

  it('still reports the missing "project" scope when even the own Projects cannot be read', async () => {
    const result = await listProjects('t', answer(200, scopeError));
    expect(result).toEqual({ ok: false, error: { code: 'project.missing-scope' } });
  });

  it('asks once when the sign-in can see everything', async () => {
    const calls: string[] = [];
    const fetchImpl: Fetch = async (_url, init) => {
      calls.push(init.body);
      return { ok: true, status: 200, json: async () => ({ data: { viewer: { login: 'me', projectsV2: { nodes: [] }, organizations: { nodes: [] } } } }) };
    };
    const result = await listProjects('t', fetchImpl);
    expect(calls).toHaveLength(1);
    expect(result).toEqual({ ok: true, projects: [] });
  });
});

describe('summarizeProject', () => {
  const card = (repository: string, assignees: string[] = []) => ({ repository, assignees });

  it('counts the repositories and the assignees, the biggest first, without regard to case', () => {
    const overview = summarizeProject({
      cards: [
        card('me/b', ['Maria']),
        card('me/A'),
        card('me/a', ['maria', 'lee']),
        card('me/a'),
        card('me/c'),
      ] as never,
    });
    expect(overview.repositories).toEqual([
      { repository: 'me/A', cards: 3 },
      { repository: 'me/b', cards: 1 },
      { repository: 'me/c', cards: 1 },
    ]);
    expect(overview.assignees).toEqual([
      { login: 'Maria', cards: 2 },
      { login: 'lee', cards: 1 },
    ]);
  });

  it('is empty for a Project with no cards', () => {
    expect(summarizeProject({ cards: [] })).toEqual({ repositories: [], assignees: [] });
  });
});
