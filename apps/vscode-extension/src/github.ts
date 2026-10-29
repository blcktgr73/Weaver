import * as vscode from 'vscode';
import { IssueSnapshot, MovePlan, parseIssueUrl } from '@palab/weaver-markdown';

export type IssueResult = { ok: true; issue: IssueSnapshot } | { ok: false; error: string };

/**
 * Uses VS Code's built-in GitHub sign-in. Reading needs `repo`; moving a card also needs `project`.
 * `interactive: false` returns a token only when the user is already signed in.
 */
export async function getGitHubToken(interactive: boolean, scopes: string[] = ['repo']): Promise<string | undefined> {
  const session = await vscode.authentication.getSession(
    'github',
    scopes,
    interactive ? { createIfNone: true } : { silent: true },
  );
  return session?.accessToken;
}

export async function fetchIssue(token: string, issueUrl: string): Promise<IssueResult> {
  const ref = parseIssueUrl(issueUrl);
  if (!ref) return { ok: false, error: 'not a GitHub Issue URL' };

  try {
    const response = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      return { ok: false, error: response.status === 404 ? 'not found or no access' : `GitHub returned ${response.status}` };
    }
    const data = (await response.json()) as {
      number: number;
      title: string;
      html_url: string;
      state: string;
      labels: ({ name?: string } | string)[];
      assignees?: { login: string }[];
    };
    return {
      ok: true,
      issue: {
        number: data.number,
        title: data.title,
        url: data.html_url,
        state: data.state === 'closed' ? 'closed' : 'open',
        labels: data.labels.map((label) => (typeof label === 'string' ? label : label.name ?? '')).filter(Boolean),
        assignees: (data.assignees ?? []).map((a) => a.login),
      },
    };
  } catch (error) {
    return { ok: false, error: `network error: ${(error as Error).message}` };
  }
}

export interface MoveStep {
  name: string;
  ok: boolean;
  detail?: string;
}

const API = 'https://api.github.com';

async function rest(token: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || json.errors?.length) {
    throw new Error(json.errors?.map((e) => e.message).join('; ') ?? `GitHub returned ${response.status}`);
  }
  return json.data as T;
}

const PROJECT_ITEMS = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){projectItems(first:10){nodes{id project{id title field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}}}}}}}`;
const SET_STATUS = `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}`;

/**
 * Applies a move plan to GitHub: labels, Issue state, then the board Status.
 * Stops at the first failure and reports the steps that ran. Callers must have
 * confirmed the plan with the user first.
 */
export async function applyMove(token: string, issueUrl: string, plan: MovePlan): Promise<MoveStep[]> {
  const ref = parseIssueUrl(issueUrl);
  const steps: MoveStep[] = [];
  if (!ref) return [{ name: 'parse Issue URL', ok: false, detail: 'not a GitHub Issue URL' }];
  const base = `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`;

  const run = async (name: string, action: () => Promise<string | undefined>): Promise<boolean> => {
    try {
      const detail = await action();
      steps.push({ name, ok: true, detail });
      return true;
    } catch (error) {
      steps.push({ name, ok: false, detail: (error as Error).message });
      return false;
    }
  };
  const expectOk = async (response: Response): Promise<void> => {
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  };

  for (const label of plan.removeLabels) {
    const ok = await run(`remove label ${label}`, async () => {
      const response = await rest(token, 'DELETE', `${base}/labels/${encodeURIComponent(label)}`);
      if (response.status !== 404) await expectOk(response);
      return undefined;
    });
    if (!ok) return steps;
  }
  const labeled = await run(`add label ${plan.addLabel}`, async () => {
    await expectOk(await rest(token, 'POST', `${base}/labels`, { labels: [plan.addLabel] }));
    return undefined;
  });
  if (!labeled) return steps;
  if (
    !(await run(`${plan.state === 'closed' ? 'close' : 'reopen'} Issue`, async () => {
      const body = plan.state === 'closed' ? { state: 'closed', state_reason: 'completed' } : { state: 'open' };
      await expectOk(await rest(token, 'PATCH', base, body));
      return undefined;
    }))
  ) {
    return steps;
  }

  await run(`set board Status to ${plan.projectStatus}`, async () => {
    type Items = {
      repository: {
        issue: {
          projectItems: {
            nodes: { id: string; project: { id: string; title: string; field: { id: string; options: { id: string; name: string }[] } | null } }[];
          };
        };
      };
    };
    const data = await graphql<Items>(token, PROJECT_ITEMS, { o: ref.owner, r: ref.repo, n: ref.number });
    const items = data.repository.issue.projectItems.nodes;
    if (items.length === 0) return 'skipped: the Issue is not on a project board';
    const updated: string[] = [];
    for (const item of items) {
      const field = item.project.field;
      const option = field?.options.find((o) => o.name === plan.projectStatus);
      if (!field || !option) throw new Error(`board "${item.project.title}" has no Status option "${plan.projectStatus}"`);
      await graphql(token, SET_STATUS, { p: item.project.id, i: item.id, f: field.id, o: option.id });
      updated.push(item.project.title);
    }
    return `updated on ${updated.join(', ')}`;
  });
  return steps;
}
