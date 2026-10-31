import { describe, expect, it } from 'vitest';
import { formatNotice } from '@palab/weaver-markdown';
import { readProject, type Fetch } from '../src';

const issue = (repository: string, number: number, extra: Record<string, unknown> = {}) => ({
  fieldValueByName: { name: 'Todo' },
  content: {
    __typename: 'Issue',
    number,
    title: `Issue ${number}`,
    url: `https://github.com/${repository}/issues/${number}`,
    state: 'OPEN',
    repository: { nameWithOwner: repository },
    labels: { nodes: [{ name: 'status:backlog' }] },
    assignees: { nodes: [] },
    ...extra,
  },
});

const page = (nodes: unknown[], next: string | null) => ({
  data: {
    repositoryOwner: {
      projectV2: { title: 'Board', items: { pageInfo: { hasNextPage: next !== null, endCursor: next }, nodes } },
    },
  },
});

/** Answers with the given pages in order and remembers what was asked. */
function fake(...replies: { status?: number; body: unknown }[]) {
  const asked: { variables: { c: string | null } }[] = [];
  const fetchImpl: Fetch = async (_url, init) => {
    asked.push(JSON.parse(init.body));
    const reply = replies[asked.length - 1];
    return { ok: (reply.status ?? 200) < 400, status: reply.status ?? 200, json: async () => reply.body };
  };
  return { fetchImpl, asked };
}

const project = { owner: 'me', number: 1 };

describe('readProject', () => {
  it('turns Issues of registered repositories into cards', async () => {
    const { fetchImpl } = fake({
      body: page(
        [
          issue('me/Weaver', 61, {
            title: '[TASK-029] Verify access',
            state: 'CLOSED',
            labels: { nodes: [{ name: 'task' }, { name: 'status:verified' }] },
            assignees: { nodes: [{ login: 'me' }] },
          }),
        ],
        null,
      ),
    });
    const result = await readProject('t', project, ['me/Weaver'], fetchImpl);
    expect(result.ok && result.read.title).toBe('Board');
    const card = result.ok ? result.read.cards[0] : undefined;
    expect(card).toMatchObject({
      repository: 'me/Weaver',
      number: 61,
      state: 'closed',
      boardStatus: 'Todo',
      taskId: 'TASK-029',
      assignees: ['me'],
      placement: { column: 'Verified', gaps: [] },
    });
  });

  it('follows the cursor until the last page', async () => {
    const { fetchImpl, asked } = fake(
      { body: page([issue('me/Weaver', 1), issue('me/Weaver', 2)], 'cursor-1') },
      { body: page([issue('me/Weaver', 3)], null) },
    );
    const result = await readProject('t', project, ['me/Weaver'], fetchImpl);
    expect(result.ok && result.read.cards.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(asked.map((a) => a.variables.c)).toEqual([null, 'cursor-1']);
  });

  it('keeps only registered repositories, ignoring case, and counts what it left out', async () => {
    const { fetchImpl } = fake({
      body: page(
        [
          issue('Me/WEAVER', 1),
          issue('me/other', 2),
          { fieldValueByName: null, content: { __typename: 'PullRequest' } },
          { fieldValueByName: null, content: null },
        ],
        null,
      ),
    });
    const result = await readProject('t', project, ['me/Weaver'], fetchImpl);
    expect(result.ok && result.read.cards.map((c) => c.number)).toEqual([1]);
    expect(result.ok && result.read.skipped).toBe(3);
  });

  it('places cards with the label rules and shows gaps', async () => {
    const { fetchImpl } = fake({ body: page([issue('me/Weaver', 1, { state: 'CLOSED' })], null) });
    const result = await readProject('t', project, ['me/Weaver'], fetchImpl);
    const card = result.ok ? result.read.cards[0] : undefined;
    expect(card?.placement.column).toBe('Review');
    expect(card?.placement.gaps.map((g) => g.code)).toEqual(['gap.closed-without-verified']);
  });

  it('omits board status and task id when absent', async () => {
    const { fetchImpl } = fake({ body: page([{ ...issue('me/Weaver', 1), fieldValueByName: null }], null) });
    const result = await readProject('t', project, ['me/Weaver'], fetchImpl);
    const card = result.ok ? result.read.cards[0] : undefined;
    expect(card && 'boardStatus' in card).toBe(false);
    expect(card && 'taskId' in card).toBe(false);
  });

  it('sends the token and the project number', async () => {
    let seen: { headers: Record<string, string>; body: string } | undefined;
    const fetchImpl: Fetch = async (_url, init) => {
      seen = init;
      return { ok: true, status: 200, json: async () => page([], null) };
    };
    await readProject('secret', { owner: 'my-org', number: 7 }, ['my-org/app'], fetchImpl);
    expect(seen?.headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(seen?.body ?? '{}').variables).toMatchObject({ o: 'my-org', n: 7 });
  });

  describe('failures come back as notices', () => {
    const code = async (reply: { status?: number; body: unknown }) => {
      const result = await readProject('t', project, ['me/Weaver'], fake(reply).fetchImpl);
      return result.ok ? 'ok' : result.error.code;
    };
    it('401 means the sign-in was rejected', async () => {
      expect(await code({ status: 401, body: {} })).toBe('project.unauthorized');
    });
    it('a missing owner or project is not found', async () => {
      expect(await code({ body: { data: { repositoryOwner: null } } })).toBe('project.not-found');
      expect(
        await code({
          body: { data: { repositoryOwner: { projectV2: null } }, errors: [{ type: 'NOT_FOUND', message: 'x' }] },
        }),
      ).toBe('project.not-found');
    });
    it('a missing scope is named', async () => {
      expect(
        await code({ body: { errors: [{ type: 'INSUFFICIENT_SCOPES', message: 'needs read:project scope' }] } }),
      ).toBe('project.missing-scope');
    });
    it('rate limits and forbidden access are told apart', async () => {
      expect(await code({ body: { errors: [{ type: 'RATE_LIMITED', message: 'slow down' }] } })).toBe(
        'project.rate-limited',
      );
      expect(await code({ status: 403, body: {} })).toBe('project.forbidden');
    });
    it('a server error or a broken body is unreachable', async () => {
      expect(await code({ status: 502, body: {} })).toBe('project.unreachable');
      const broken: Fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('bad json');
        },
      });
      const result = await readProject('t', project, ['me/Weaver'], broken);
      expect(!result.ok && result.error.code).toBe('project.unreachable');
    });
    it('a network failure does not throw', async () => {
      const down: Fetch = async () => {
        throw new Error('offline');
      };
      const result = await readProject('t', project, ['me/Weaver'], down);
      expect(!result.ok && result.error.code).toBe('project.unreachable');
    });
    it('stops when the Project is endless', async () => {
      const endless: Fetch = async () => ({ ok: true, status: 200, json: async () => page([], 'again') });
      const result = await readProject('t', project, ['me/Weaver'], endless);
      expect(!result.ok && result.error.code).toBe('project.too-large');
    });
  });

  it('has a readable message in English and Korean for every failure', () => {
    const names = ['unreachable', 'unauthorized', 'missing-scope', 'forbidden', 'not-found', 'rate-limited', 'too-large'];
    for (const name of names) {
      for (const locale of ['en', 'ko'] as const) {
        const text = formatNotice({ code: `project.${name}` as never, args: { owner: 'me', number: 1, pages: 50 } }, locale);
        expect(text).not.toBe(`project.${name}`);
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
