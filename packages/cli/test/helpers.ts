import type { Fetch } from '@palab/weaver-github';
import type { Deps, LogEntry } from '../src';

export const REGISTRY = 'project: {owner: me, number: 1}\nrepositories:\n  - me/Weaver\n';

export const issue = (number: number, extra: Record<string, unknown> = {}) => ({
  fieldValueByName: { name: 'In Progress' },
  content: {
    __typename: 'Issue',
    number,
    title: `[TASK-0${number}] Card ${number}`,
    url: `https://github.com/me/Weaver/issues/${number}`,
    state: 'OPEN',
    updatedAt: '2026-10-01T00:00:00Z',
    closedByPullRequestsReferences: { totalCount: 0 },
    timelineItems: { totalCount: 0 },
    repository: { nameWithOwner: 'me/Weaver' },
    labels: { nodes: [{ name: 'status:in-progress' }] },
    assignees: { nodes: [] },
    ...extra,
  },
});

export const FILES = [
  {
    path: 'requirements/REQ-001.md',
    text: '---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nrepository: me/Weaver\n---\n\n## Acceptance criteria\n\n- First thing\n- Second thing\n\n## Tasks\n\n- `TASK-010` Card ten — [GitHub Issue #10](https://github.com/me/Weaver/issues/10)\n',
  },
  {
    path: 'tasks/TASK-010.md',
    text: '---\nid: TASK-010\ntype: task\ntitle: Card ten\nrequirement: REQ-001\nissue: https://github.com/me/Weaver/issues/10\nassignee_type: agent\nassignee: claude-code\n---\n',
  },
];

export function setup(options: { token?: string | undefined; registry?: string; pullsFail?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const writes: string[] = [];
  const logged: LogEntry[] = [];
  const shell: { command: string; args: string[]; cwd?: string }[] = [];
  const written: { file: string; text: string }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    if (url.includes('/repos/')) {
      writes.push(`REST ${url}`);
      return { ok: true, status: 201, json: async () => ({ number: 77, html_url: 'https://github.com/me/Weaver/issues/77' }) };
    }
    const query = JSON.parse(init.body).query as string;
    writes.push(query);
    if (query.includes('resource(url')) {
      return { ok: true, status: 200, json: async () => ({ data: { repositoryOwner: { projectV2: { id: 'PROJECT' } }, resource: { id: 'ISSUE' } } }) };
    }
    if (query.includes('addProjectV2ItemById')) return { ok: true, status: 200, json: async () => ({ data: { addProjectV2ItemById: { item: { id: 'ITEM' } } } }) };
    if (query.includes('projectV2')) {
      const body = { data: { repositoryOwner: { projectV2: { title: 'Board', items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [issue(10), issue(11)] } } } } };
      return { ok: true, status: 200, json: async () => body };
    }
    if (options.pullsFail) return { ok: false, status: 500, json: async () => ({}) };
    const nodes = [{ number: 7, title: 'feat: ten (TASK-010)', url: 'https://github.com/me/Weaver/pull/7', headRefName: 'feat/task-010', closingIssuesReferences: { nodes: [{ number: 10 }] } }];
    return { ok: true, status: 200, json: async () => ({ data: { repository: { pullRequests: { nodes } } } }) };
  };
  const deps: Deps = {
    cwd: '/work',
    env: {},
    out: (text) => void out.push(text),
    err: (text) => void err.push(text),
    token: async () => ('token' in options ? options.token : 't'),
    fetch: fetchImpl,
    files: async () => FILES,
    readText: async () => ('registry' in options ? options.registry : REGISTRY),
    now: () => new Date('2026-11-01T00:00:00Z'),
    login: async () => 'me',
    interactive: false,
    ask: async () => false,
    prompt: async () => '',
    log: { append: async (entry) => void logged.push(entry) },
    system: {
      run: async (command, args, options) => {
        shell.push({ command, args, cwd: options?.cwd });
        if (command === 'gh' && args[0] === 'pr' && args[1] === 'create') return 'https://github.com/me/Weaver/pull/200\n';
        if (command === 'gh' && args[0] === 'pr') return JSON.stringify([{ title: 'docs: add TASK-040 x', headRefName: 'docs/task-040-x' }]);
        if (command === 'gh') return 'main\n';
        if (args[0] === 'rev-parse') return '/work\n';
        return '';
      },
      tempDir: async () => '/tmp/work',
      readText: async (file) => (file.endsWith('REQ-001.md') ? FILES[0].text : undefined),
      writeFile: async (file, text) => void written.push({ file, text }),
    },
  };
  return { deps, out, err, writes, logged, shell, written };
}


/** Answers the REST and board calls of a move or an evidence link, and records each one. */
export function withGitHub(deps: Deps, options: { linkedPull?: boolean; pullMerged?: boolean } = {}) {
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const original = deps.fetch as Fetch;
  deps.fetch = async (url, init) => {
    const reply = (json: unknown, status = 200) => ({ ok: status < 400, status, json: async () => json });
    if (url.includes('/repos/')) {
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url.replace('https://api.github.com', '')}`);
      if (init?.body) bodies.push(JSON.parse(init.body));
      if (url.includes('/timeline')) {
        return reply(options.linkedPull
          ? [{ event: 'cross-referenced', source: { issue: { number: 7, title: 'feat: ten (TASK-010)', html_url: 'https://github.com/me/Weaver/pull/7', repository_url: 'https://api.github.com/repos/me/Weaver', pull_request: {} } } }]
          : []);
      }
      if (url.endsWith('/pulls/7')) return reply({ state: 'closed', merged_at: options.pullMerged === false ? null : '2026-11-01T00:00:00Z', body: 'Closes #10', head: { sha: 'abc' }, number: 7, title: 'feat: ten (TASK-010)', html_url: 'https://github.com/me/Weaver/pull/7' });
      if (url.endsWith('/pulls/9')) return reply({}, 404);
      if (url.includes('/check-runs')) return reply({ check_runs: [{ status: 'completed', conclusion: 'success' }] });
      return reply({});
    }
    if (init?.body) {
      const query = JSON.parse(init.body).query as string;
      if (query.includes('projectItems(first:10){nodes{id project')) {
        calls.push('POST graphql items');
        return reply({ data: { repository: { issue: { projectItems: { nodes: [{ id: 'ITEM', project: { id: 'PROJECT', title: 'Board', field: { id: 'FIELD', options: [{ id: 'S', name: 'In Progress' }, { id: 'R', name: 'In Progress' }, { id: 'D', name: 'Done' }] } } }] } } } } });
      }
      if (query.includes('updateProjectV2ItemFieldValue')) {
        calls.push('POST graphql status');
        return reply({ data: {} });
      }
    }
    return original(url, init);
  };
  return { calls, bodies };
}
