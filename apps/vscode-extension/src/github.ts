import * as vscode from 'vscode';
import {
  BoardItem,
  CheckRunLike,
  closesIssue,
  IssueSnapshot,
  MovePlan,
  Notice,
  parseIssueUrl,
  PullEvidence,
  summarizeChecks,
  TaskEvidence,
} from '@palab/weaver-markdown';

export type IssueResult = { ok: true; issue: IssueSnapshot } | { ok: false; error: Notice };

const raw = (detail: string): Notice => ({ code: 'github.err.raw', args: { detail } });

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
  if (!ref) return { ok: false, error: { code: 'github.err.not-issue-url' } };

  try {
    const response = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: response.status === 404 ? { code: 'github.err.not-found' } : { code: 'github.err.http', args: { status: response.status } },
      };
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
    return { ok: false, error: { code: 'github.err.network', args: { detail: (error as Error).message } } };
  }
}

export interface MoveStep {
  name: Notice;
  ok: boolean;
  detail?: Notice;
  /** The step had nothing to do, for example an Issue that is not on a board. */
  skipped?: boolean;
}

const API = 'https://api.github.com';

/** An error whose message can be shown in any language. */
class WeaverError extends Error {
  constructor(readonly notice: Notice) {
    super(notice.code);
  }
}

function errorNotice(error: unknown): Notice {
  return error instanceof WeaverError ? error.notice : raw((error as Error).message);
}

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
  if (!ref) return [{ name: { code: 'step.parse-url' }, ok: false, detail: { code: 'github.err.not-issue-url' } }];
  const base = `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`;

  const run = async (name: Notice, action: () => Promise<Notice | undefined>): Promise<boolean> => {
    try {
      const detail = await action();
      steps.push({ name, ok: true, ...(detail ? { detail, skipped: detail.code === 'step.skipped-no-board' } : {}) });
      return true;
    } catch (error) {
      steps.push({ name, ok: false, detail: errorNotice(error) });
      return false;
    }
  };
  const expectOk = async (response: Response): Promise<void> => {
    if (!response.ok) throw new WeaverError({ code: 'github.err.http', args: { status: response.status } });
  };

  for (const label of plan.removeLabels) {
    const ok = await run({ code: 'step.remove-label', args: { label } }, async () => {
      const response = await rest(token, 'DELETE', `${base}/labels/${encodeURIComponent(label)}`);
      if (response.status !== 404) await expectOk(response);
      return undefined;
    });
    if (!ok) return steps;
  }
  const labeled = await run({ code: 'step.add-label', args: { label: plan.addLabel } }, async () => {
    await expectOk(await rest(token, 'POST', `${base}/labels`, { labels: [plan.addLabel] }));
    return undefined;
  });
  if (!labeled) return steps;
  if (
    !(await run({ code: plan.state === 'closed' ? 'step.close-issue' : 'step.reopen-issue' }, async () => {
      const body = plan.state === 'closed' ? { state: 'closed', state_reason: 'completed' } : { state: 'open' };
      await expectOk(await rest(token, 'PATCH', base, body));
      return undefined;
    }))
  ) {
    return steps;
  }

  await run({ code: 'step.set-board-status', args: { status: plan.projectStatus } }, async () => {
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
    if (items.length === 0) return { code: 'step.skipped-no-board' };
    const updated: string[] = [];
    for (const item of items) {
      const field = item.project.field;
      const option = field?.options.find((o) => o.name === plan.projectStatus);
      if (!field || !option) throw new WeaverError({ code: 'step.no-status-option', args: { board: item.project.title, status: plan.projectStatus } });
      await graphql(token, SET_STATUS, { p: item.project.id, i: item.id, f: field.id, o: option.id });
      updated.push(item.project.title);
    }
    return { code: 'step.updated-boards', args: { boards: updated } };
  });
  return steps;
}

const BOARD_ITEMS = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){issue(number:$n){projectItems(first:10){nodes{project{title} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}`;

/**
 * The Issue's Status on each project board. Best effort: reading a board needs
 * the project scope, so a failure means "unknown" and no mismatch is reported.
 */
export async function fetchBoardItems(token: string, issueUrl: string): Promise<BoardItem[] | undefined> {
  const ref = parseIssueUrl(issueUrl);
  if (!ref) return undefined;
  try {
    type Nodes = {
      repository: { issue: { projectItems: { nodes: { project: { title: string }; fieldValueByName: { name?: string } | null }[] } } };
    };
    const data = await graphql<Nodes>(token, BOARD_ITEMS, { o: ref.owner, r: ref.repo, n: ref.number });
    return data.repository.issue.projectItems.nodes.flatMap((node) =>
      node.fieldValueByName?.name ? [{ project: node.project.title, status: node.fieldValueByName.name }] : [],
    );
  } catch {
    return undefined;
  }
}

export type EvidenceResult = { ok: true; evidence: TaskEvidence } | { ok: false; error: Notice };

async function getJson<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new WeaverError({ code: 'github.err.http', args: { status: response.status } });
  return (await response.json()) as T;
}

interface TimelineEvent {
  event: string;
  source?: {
    issue?: {
      number: number;
      title: string;
      html_url: string;
      repository_url: string;
      pull_request?: object;
    };
  };
}

/**
 * Finds pull requests that reference the Issue (timeline cross-references),
 * then reads each one's merge state and check runs. A reference is a link,
 * not proof the PR implements the task; the view says so.
 */
export async function fetchEvidence(token: string, issueUrl: string): Promise<EvidenceResult> {
  const ref = parseIssueUrl(issueUrl);
  if (!ref) return { ok: false, error: { code: 'github.err.not-issue-url' } };

  try {
    const events: TimelineEvent[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const batch = await getJson<TimelineEvent[]>(
        token,
        `${API}/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/timeline?per_page=100&page=${page}`,
      );
      events.push(...batch);
      if (batch.length < 100) break;
    }

    const sources = new Map<string, NonNullable<NonNullable<TimelineEvent['source']>['issue']>>();
    for (const event of events) {
      const source = event.source?.issue;
      if (event.event === 'cross-referenced' && source?.pull_request && source.repository_url.startsWith(`${API}/repos/`)) {
        sources.set(source.html_url, source);
      }
    }

    const pulls = await Promise.all(
      [...sources.values()].map(async (source): Promise<PullEvidence> => {
        const pr = await getJson<{ state: string; merged_at: string | null; body: string | null; head: { sha: string } }>(
          token,
          `${source.repository_url}/pulls/${source.number}`,
        );
        const runs = await getJson<{ check_runs: CheckRunLike[] }>(
          token,
          `${source.repository_url}/commits/${pr.head.sha}/check-runs?per_page=100`,
        );
        return {
          number: source.number,
          title: source.title,
          url: source.html_url,
          state: pr.merged_at ? 'merged' : pr.state === 'open' ? 'open' : 'closed',
          checks: summarizeChecks(runs.check_runs),
          link: closesIssue(`${source.title}
${pr.body ?? ''}`, ref.number) ? 'closes' : 'mentions',
        };
      }),
    );
    return { ok: true, evidence: { pulls: pulls.sort((a, b) => a.number - b.number) } };
  } catch (error) {
    return { ok: false, error: errorNotice(error) };
  }
}
