import { describe, expect, it } from 'vitest';
import { planMove } from '@palab/weaver-markdown';
import { addIssueComment, applyMove, fetchEvidence, fetchIssue, fetchPull, hasIssueComment, setBoardStatus, type FetchFn } from '../src';

const ISSUE = 'https://github.com/me/Weaver/issues/5';

type Call = { method: string; url: string; body?: unknown };

/** A fetch that answers by route and remembers every call. */
function routes(answer: (call: Call) => { status?: number; json?: unknown }) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init?: { method?: string; body?: string }) => {
    const call: Call = { method: init?.method ?? 'GET', url, ...(init?.body ? { body: JSON.parse(init.body) } : {}) };
    calls.push(call);
    const reply = answer(call);
    const status = reply.status ?? 200;
    return { ok: status < 400, status, json: async () => reply.json ?? {} };
  }) as unknown as FetchFn;
  return { fetchFn, calls };
}

describe('fetchIssue', () => {
  it('reads the number, title, state, labels, and assignees', async () => {
    const { fetchFn } = routes(() => ({
      json: { number: 5, title: 'T', html_url: ISSUE, state: 'open', labels: [{ name: 'task' }, 'status:review'], assignees: [{ login: 'me' }] },
    }));
    const result = await fetchIssue('t', ISSUE, fetchFn);
    expect(result).toEqual({ ok: true, issue: { number: 5, title: 'T', url: ISSUE, state: 'open', labels: ['task', 'status:review'], assignees: ['me'] } });
  });

  it('turns a missing Issue, a bad address, and a network failure into notices', async () => {
    expect(await fetchIssue('t', ISSUE, routes(() => ({ status: 404 })).fetchFn)).toMatchObject({ ok: false, error: { code: 'github.err.not-found' } });
    expect(await fetchIssue('t', 'nope', routes(() => ({})).fetchFn)).toMatchObject({ ok: false, error: { code: 'github.err.not-issue-url' } });
    const broken = (async () => {
      throw new Error('offline');
    }) as unknown as FetchFn;
    expect(await fetchIssue('t', ISSUE, broken)).toMatchObject({ ok: false, error: { code: 'github.err.network' } });
  });
});

describe('applyMove', () => {
  const plan = planMove({ state: 'open', labels: ['task', 'status:review'] }, 'Verified');
  const answer = (call: Call) => {
    if (call.url.endsWith('/graphql')) {
      const query = (call.body as { query: string }).query;
      if (query.includes('projectItems(first:10){nodes{id project')) {
        return { json: { data: { repository: { issue: { projectItems: { nodes: [{ id: 'ITEM', project: { id: 'PROJECT', title: 'Board', field: { id: 'FIELD', options: [{ id: 'DONE', name: 'Done' }] } } }] } } } } } };
      }
      return { json: { data: {} } };
    }
    return {};
  };

  it('removes the old label, adds the new one, closes the Issue, and sets the board Status, in that order', async () => {
    const { fetchFn, calls } = routes(answer);
    const steps = await applyMove('t', ISSUE, plan, fetchFn);
    expect(steps.every((s) => s.ok)).toBe(true);
    expect(calls.map((c) => `${c.method} ${c.url.replace('https://api.github.com', '')}`)).toEqual([
      'DELETE /repos/me/Weaver/issues/5/labels/status%3Areview',
      'POST /repos/me/Weaver/issues/5/labels',
      'PATCH /repos/me/Weaver/issues/5',
      'POST /graphql',
      'POST /graphql',
    ]);
    expect(calls[1].body).toEqual({ labels: ['status:verified'] });
    expect(calls[2].body).toEqual({ state: 'closed', state_reason: 'completed' });
    expect(calls[4].body).toMatchObject({ variables: { p: 'PROJECT', i: 'ITEM', f: 'FIELD', o: 'DONE' } });
  });

  it('stops at the first failure and reports the steps that ran', async () => {
    const { fetchFn, calls } = routes((call) => (call.method === 'POST' && call.url.endsWith('/labels') ? { status: 403 } : answer(call)));
    const steps = await applyMove('t', ISSUE, plan, fetchFn);
    expect(steps.map((s) => s.ok)).toEqual([true, false]);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('skips the board step for an Issue that is not on a board', async () => {
    const { fetchFn } = routes((call) => (call.url.endsWith('/graphql') ? { json: { data: { repository: { issue: { projectItems: { nodes: [] } } } } } } : {}));
    const steps = await applyMove('t', ISSUE, plan, fetchFn);
    expect(steps[steps.length - 1]).toMatchObject({ ok: true, skipped: true });
  });
});

describe('fetchEvidence', () => {
  it('finds the pull requests that reference the Issue and how they stand', async () => {
    const { fetchFn } = routes((call) => {
      if (call.url.includes('/timeline')) {
        return {
          json: [
            {
              event: 'cross-referenced',
              source: { issue: { number: 7, title: 'feat: five', html_url: 'https://github.com/me/Weaver/pull/7', repository_url: 'https://api.github.com/repos/me/Weaver', pull_request: {} } },
            },
          ],
        };
      }
      if (call.url.endsWith('/pulls/7')) return { json: { state: 'closed', merged_at: '2026-11-01T00:00:00Z', body: 'Closes #5', head: { sha: 'abc' } } };
      return { json: { check_runs: [{ status: 'completed', conclusion: 'success' }] } };
    });
    const result = await fetchEvidence('t', ISSUE, fetchFn);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.evidence.pulls).toMatchObject([{ number: 7, state: 'merged', link: 'closes' }]);
  });

  it('turns a failed call into a notice', async () => {
    const result = await fetchEvidence('t', ISSUE, routes(() => ({ status: 500 })).fetchFn);
    expect(result).toMatchObject({ ok: false, error: { code: 'github.err.http' } });
  });
});

describe('fetchPull and addIssueComment', () => {
  it('says whether a pull request was merged', async () => {
    const merged = routes(() => ({ json: { number: 7, title: 'feat', html_url: 'https://github.com/me/Weaver/pull/7', merged_at: '2026-11-01T00:00:00Z' } }));
    expect(await fetchPull('t', 'me/Weaver', 7, merged.fetchFn)).toEqual({ number: 7, title: 'feat', url: 'https://github.com/me/Weaver/pull/7', merged: true });
    const open = routes(() => ({ json: { number: 8, title: 'wip', html_url: 'u', merged_at: null } }));
    expect((await fetchPull('t', 'me/Weaver', 8, open.fetchFn)).merged).toBe(false);
  });

  it('fails with what GitHub answered', async () => {
    await expect(fetchPull('t', 'me/Weaver', 9, routes(() => ({ status: 404 })).fetchFn)).rejects.toThrow('#9 of me/Weaver was not found');
    await expect(fetchPull('t', 'me/Weaver', 9, routes(() => ({ status: 500 })).fetchFn)).rejects.toThrow('500');
  });

  it('posts a comment to the Issue', async () => {
    const { fetchFn, calls } = routes(() => ({ status: 201 }));
    await addIssueComment('t', 'me/Weaver', 5, 'hello', fetchFn);
    expect(calls).toEqual([{ method: 'POST', url: 'https://api.github.com/repos/me/Weaver/issues/5/comments', body: { body: 'hello' } }]);
    await expect(addIssueComment('t', 'me/Weaver', 5, 'x', routes(() => ({ status: 403 })).fetchFn)).rejects.toThrow('403');
  });
});

describe('setBoardStatus and hasIssueComment', () => {
  const items = (options: { name: string }[]) => ({
    json: { data: { repository: { issue: { projectItems: { nodes: [{ id: 'ITEM', project: { id: 'PROJECT', title: 'Board', field: { id: 'FIELD', options: options.map((o, i) => ({ id: `O${i}`, name: o.name })) } } }] } } } } },
  });

  it('sets the Status on the board the Issue is on', async () => {
    const { fetchFn, calls } = routes((call) => ((call.body as { query?: string } | undefined)?.query?.includes('projectItems(first:10){nodes{id project') ? items([{ name: 'Todo' }, { name: 'Done' }]) : { json: { data: {} } }));
    const notice = await setBoardStatus('t', ISSUE, 'Done', fetchFn);
    expect(notice).toMatchObject({ code: 'step.updated-boards' });
    expect(calls[1].body).toMatchObject({ variables: { p: 'PROJECT', i: 'ITEM', f: 'FIELD', o: 'O1' } });
  });

  it('has nothing to set for an Issue on no board, and fails when the board has no such option', async () => {
    const none = routes(() => ({ json: { data: { repository: { issue: { projectItems: { nodes: [] } } } } } }));
    expect(await setBoardStatus('t', ISSUE, 'Done', none.fetchFn)).toEqual({ code: 'step.skipped-no-board' });
    const noOption = routes(() => items([{ name: 'Todo' }]));
    await expect(setBoardStatus('t', ISSUE, 'Done', noOption.fetchFn)).rejects.toThrow();
    await expect(setBoardStatus('t', 'nope', 'Done', none.fetchFn)).rejects.toThrow();
  });

  it('finds a marker among the comments of an Issue', async () => {
    const { fetchFn, calls } = routes(() => ({ json: [{ body: 'hello' }, { body: 'note <!-- weaver:pull-7 -->' }] }));
    expect(await hasIssueComment('t', 'me/Weaver', 5, '<!-- weaver:pull-7 -->', fetchFn)).toBe(true);
    expect(await hasIssueComment('t', 'me/Weaver', 5, '<!-- weaver:pull-8 -->', fetchFn)).toBe(false);
    expect(calls[0].url).toContain('/repos/me/Weaver/issues/5/comments');
    await expect(hasIssueComment('t', 'me/Weaver', 5, 'x', routes(() => ({ status: 500 })).fetchFn)).rejects.toThrow('500');
  });
});
