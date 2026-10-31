import { describe, expect, it } from 'vitest';
import { addIssueToProject, createIssue, type Fetch } from '../src';

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

describe('createIssue', () => {
  it('posts the Issue to its repository and returns its number and address', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl: Fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 201, json: async () => ({ number: 12, html_url: 'https://github.com/me/Weaver/issues/12' }) };
    };
    const made = await createIssue('t', 'me/Weaver', { title: 'T', body: 'B', labels: ['task'] }, fetchImpl);
    expect(made).toEqual({ number: 12, url: 'https://github.com/me/Weaver/issues/12' });
    expect(calls).toEqual([{ url: 'https://api.github.com/repos/me/Weaver/issues', body: { title: 'T', body: 'B', labels: ['task'] } }]);
  });

  it('reports a refusal with what GitHub said', async () => {
    const refuse = (status: number, message: string): Fetch => async () => ({ ok: false, status, json: async () => ({ message }) });
    await expect(createIssue('t', 'me/x', { title: '', body: '', labels: [] }, refuse(404, 'Not Found'))).rejects.toThrow('404: Not Found');
    await expect(createIssue('t', 'me/x', { title: '', body: '', labels: [] }, refuse(401, 'Bad credentials'))).rejects.toThrow('401');
  });
});
