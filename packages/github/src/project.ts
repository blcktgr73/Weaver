import { placeIssue, type KanbanPlacement, type Notice } from '@palab/weaver-markdown';

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** One Issue on the central Project, reduced to what the Overview Kanban shows. */
export interface ProjectCard {
  /** `owner/name`, as GitHub spells it. */
  repository: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  /** The board `Status` field, when the item has one. */
  boardStatus?: string;
  /** `TASK-###` when the Issue title starts with `[TASK-###]`. */
  taskId?: string;
  placement: KanbanPlacement;
}

export interface ProjectRead {
  title: string;
  cards: ProjectCard[];
  /** Items left out: pull requests, drafts, and Issues of repositories that are not registered. */
  skipped: number;
}

export type ProjectResult = { ok: true; read: ProjectRead } | { ok: false; error: Notice };

const API = 'https://api.github.com/graphql';
const PAGE = 100;
const MAX_PAGES = 50;

const QUERY = `query($o:String!,$n:Int!,$c:String){repositoryOwner(login:$o){... on ProjectV2Owner{projectV2(number:$n){title items(first:${PAGE},after:$c){pageInfo{hasNextPage endCursor} nodes{fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}} content{__typename ... on Issue{number title url state repository{nameWithOwner} labels(first:20){nodes{name}} assignees(first:10){nodes{login}}}}}}}}}}`;

interface ItemNode {
  fieldValueByName: { name?: string } | null;
  content: null | {
    __typename: string;
    number?: number;
    title?: string;
    url?: string;
    state?: string;
    repository?: { nameWithOwner: string };
    labels?: { nodes: { name: string }[] };
    assignees?: { nodes: { login: string }[] };
  };
}

interface Page {
  repositoryOwner: null | {
    projectV2?: null | {
      title: string;
      items: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ItemNode[] };
    };
  };
}

const TASK_TITLE = /^\[(TASK-\d{3,})\]/;

/**
 * Reads every item of a Project, page by page, and turns the Issues of the
 * registered repositories into cards. Failures come back as notices, never as
 * exceptions, so the caller can show the reason and fall back to files.
 *
 * `fetchImpl` defaults to the global `fetch`; tests and other hosts may pass their own.
 */
export async function readProject(
  token: string,
  project: { owner: string; number: number },
  repositories: readonly string[],
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<ProjectResult> {
  const registered = new Set(repositories.map((name) => name.toLowerCase()));
  const cards: ProjectCard[] = [];
  let skipped = 0;
  let title = '';
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let response;
    try {
      response = await fetchImpl(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { o: project.owner, n: project.number, c: cursor } }),
      });
    } catch {
      return { ok: false, error: { code: 'project.unreachable' } };
    }

    if (response.status === 401) return { ok: false, error: { code: 'project.unauthorized' } };
    let body: { data?: Page; errors?: { type?: string; message: string }[] };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      return { ok: false, error: { code: 'project.unreachable' } };
    }
    const failure = describeFailure(response, body, project);
    if (failure) return { ok: false, error: failure };

    const found = body.data?.repositoryOwner?.projectV2;
    if (!found) return { ok: false, error: { code: 'project.not-found', args: { owner: project.owner, number: project.number } } };
    title = found.title;

    for (const node of found.items.nodes) {
      const issue = node.content;
      const repository = issue?.repository?.nameWithOwner;
      if (issue?.__typename !== 'Issue' || !repository || !registered.has(repository.toLowerCase())) {
        skipped += 1;
        continue;
      }
      const state = issue.state === 'CLOSED' ? 'closed' : 'open';
      const labels = (issue.labels?.nodes ?? []).map((label) => label.name);
      const taskId = TASK_TITLE.exec(issue.title ?? '')?.[1];
      cards.push({
        repository,
        number: issue.number as number,
        title: issue.title ?? '',
        url: issue.url ?? '',
        state,
        labels,
        assignees: (issue.assignees?.nodes ?? []).map((a) => a.login),
        ...(node.fieldValueByName?.name ? { boardStatus: node.fieldValueByName.name } : {}),
        ...(taskId ? { taskId } : {}),
        placement: placeIssue({ state, labels }),
      });
    }

    if (!found.items.pageInfo.hasNextPage) return { ok: true, read: { title, cards, skipped } };
    cursor = found.items.pageInfo.endCursor;
  }
  return { ok: false, error: { code: 'project.too-large', args: { pages: MAX_PAGES } } };
}

function describeFailure(
  response: { ok: boolean; status: number },
  body: { data?: Page; errors?: { type?: string; message: string }[] },
  project: { owner: string; number: number },
): Notice | undefined {
  const errors = body.errors ?? [];
  if (errors.some((e) => e.type === 'NOT_FOUND')) {
    return { code: 'project.not-found', args: { owner: project.owner, number: project.number } };
  }
  if (errors.some((e) => e.type === 'INSUFFICIENT_SCOPES' || /scope/i.test(e.message))) {
    return { code: 'project.missing-scope' };
  }
  if (errors.some((e) => e.type === 'RATE_LIMITED')) return { code: 'project.rate-limited' };
  if (response.status === 403) return { code: 'project.forbidden' };
  if (!response.ok || errors.length) return { code: 'project.unreachable' };
  return undefined;
}
