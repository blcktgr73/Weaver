import { describe, expect, it } from 'vitest';
import { addIssueToProject, type Fetch } from '../src';

const project = { owner: 'me', number: 1 };

/** Answers with the given replies in order and remembers what was asked. */
function fake(...replies: { status?: number; body: unknown }[]) {
  const asked: { query: string; variables: Record<string, unknown> }[] = [];
  const fetchImpl: Fetch = async (_url, init) => {
    asked.push(JSON.parse(init.body));
    const reply = replies[asked.length - 1];
    return { ok: (reply.status ?? 200) < 400, status: reply.status ?? 200, json: async () => reply.body };
  };
  return { fetchImpl, asked };
}

const lookup = (extra: Record<string, unknown> = {}) => ({
  data: { repositoryOwner: { projectV2: { id: 'PROJECT' } }, resource: { id: 'ISSUE' }, ...extra },
});

describe('addIssueToProject', () => {
  it('looks up the Project and the Issue, then adds the Issue', async () => {
    const { fetchImpl, asked } = fake({ body: lookup() }, { body: { data: { addProjectV2ItemById: { item: { id: 'ITEM' } } } } });
    await addIssueToProject('t', project, 'https://github.com/me/Weaver/issues/5', fetchImpl);
    expect(asked).toHaveLength(2);
    expect(asked[0].variables).toEqual({ o: 'me', n: 1, u: 'https://github.com/me/Weaver/issues/5' });
    expect(asked[1].variables).toEqual({ p: 'PROJECT', c: 'ISSUE' });
    expect(asked[1].query).toContain('addProjectV2ItemById');
  });

  it('fails without adding when the Project or the Issue cannot be found', async () => {
    let r = fake({ body: lookup({ repositoryOwner: { projectV2: null } }) });
    await expect(addIssueToProject('t', project, 'u', r.fetchImpl)).rejects.toThrow('Project 1 of me was not found');
    expect(r.asked).toHaveLength(1);

    r = fake({ body: lookup({ resource: null }) });
    await expect(addIssueToProject('t', project, 'https://github.com/me/x/issues/9', r.fetchImpl)).rejects.toThrow('not an Issue');
    expect(r.asked).toHaveLength(1);
  });

  it('reports what GitHub answered when the call is refused', async () => {
    await expect(addIssueToProject('t', project, 'u', fake({ status: 401, body: {} }).fetchImpl)).rejects.toThrow('401');
    await expect(addIssueToProject('t', project, 'u', fake({ status: 502, body: {} }).fetchImpl)).rejects.toThrow('502');
    await expect(
      addIssueToProject('t', project, 'u', fake({ body: lookup() }, { body: { errors: [{ message: 'Resource not accessible' }] } }).fetchImpl),
    ).rejects.toThrow('Resource not accessible');
  });
});
