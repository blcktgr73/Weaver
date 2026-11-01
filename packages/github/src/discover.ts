import type { Notice } from '@palab/weaver-markdown';
import type { Fetch, ProjectRead } from './project';

/** A Project a person can see, as the setup lists it. */
export interface ProjectSummary {
  /** The user or organization that owns the Project. */
  owner: string;
  number: number;
  title: string;
  /** The number of items on it, of every kind. */
  items: number;
  closed: boolean;
}

export type ProjectsResult = { ok: true; projects: ProjectSummary[] } | { ok: false; error: Notice };

const API = 'https://api.github.com/graphql';
const PAGE = 50;

const PROJECT_FIELDS = 'number title closed items{totalCount}';
const QUERY = `query{viewer{login projectsV2(first:${PAGE}){nodes{${PROJECT_FIELDS}}} organizations(first:${PAGE}){nodes{login projectsV2(first:${PAGE}){nodes{${PROJECT_FIELDS}}}}}}}`;

interface Node {
  number: number;
  title: string;
  closed: boolean;
  items: { totalCount: number };
}

interface Reply {
  data?: {
    viewer: {
      login: string;
      projectsV2: { nodes: Node[] };
      organizations: { nodes: { login: string; projectsV2: { nodes: Node[] } }[] };
    };
  };
  errors?: { type?: string; message: string }[];
}

const toSummary = (owner: string, node: Node): ProjectSummary => ({ owner, number: node.number, title: node.title, items: node.items.totalCount, closed: node.closed });

/**
 * The Projects of the signed-in person and of the organizations they belong to, for the setup to
 * offer. The first page of each (50) is read, which is far more than a person usually has. Reading
 * a Project needs the `project` scope; without it the answer is a notice that says so.
 */
export async function listProjects(token: string, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<ProjectsResult> {
  let response;
  try {
    response = await fetchImpl(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    });
  } catch {
    return { ok: false, error: { code: 'project.unreachable' } };
  }
  if (response.status === 401) return { ok: false, error: { code: 'project.unauthorized' } };

  let body: Reply;
  try {
    body = (await response.json()) as Reply;
  } catch {
    return { ok: false, error: { code: 'project.unreachable' } };
  }
  const errors = body.errors ?? [];
  if (errors.some((e) => e.type === 'INSUFFICIENT_SCOPES' || /scope/i.test(e.message))) return { ok: false, error: { code: 'project.missing-scope' } };
  if (errors.some((e) => e.type === 'RATE_LIMITED')) return { ok: false, error: { code: 'project.rate-limited' } };
  if (response.status === 403) return { ok: false, error: { code: 'project.forbidden' } };
  if (!response.ok || errors.length || !body.data) return { ok: false, error: { code: 'project.unreachable' } };

  const { viewer } = body.data;
  const projects = [
    ...viewer.projectsV2.nodes.map((node) => toSummary(viewer.login, node)),
    ...viewer.organizations.nodes.flatMap((org) => org.projectsV2.nodes.map((node) => toSummary(org.login, node))),
  ];
  return { ok: true, projects: projects.filter((p) => !p.closed) };
}

/** What a chosen Project holds: the repositories with cards on it, and who the cards are assigned to. */
export interface ProjectOverview {
  /** Repositories with their number of cards, the biggest first and then by name. */
  repositories: { repository: string; cards: number }[];
  /** Assignees with their number of cards, the biggest first and then by name. */
  assignees: { login: string; cards: number }[];
}

const byCountThenName = <T extends { cards: number }>(name: (item: T) => string) => (a: T, b: T) =>
  b.cards - a.cards || name(a).toLowerCase().localeCompare(name(b).toLowerCase());

/**
 * Counts the repositories and the assignees of what `readProject` read, for the setup to show: the
 * repositories to keep or leave out, and the people to offer as roster candidates.
 */
export function summarizeProject(read: Pick<ProjectRead, 'cards'>): ProjectOverview {
  const repositories = new Map<string, { repository: string; cards: number }>();
  const assignees = new Map<string, { login: string; cards: number }>();
  for (const card of read.cards) {
    const repo = repositories.get(card.repository.toLowerCase()) ?? { repository: card.repository, cards: 0 };
    repo.cards += 1;
    repositories.set(card.repository.toLowerCase(), repo);
    for (const login of card.assignees) {
      const person = assignees.get(login.toLowerCase()) ?? { login, cards: 0 };
      person.cards += 1;
      assignees.set(login.toLowerCase(), person);
    }
  }
  return {
    repositories: [...repositories.values()].sort(byCountThenName((r) => r.repository)),
    assignees: [...assignees.values()].sort(byCountThenName((a) => a.login)),
  };
}
