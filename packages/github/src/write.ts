import { NoticeError } from './errors';
import type { Fetch } from './project';

const API = 'https://api.github.com/graphql';

const LOOKUP = `query($o:String!,$n:Int!,$u:URI!){repositoryOwner(login:$o){... on ProjectV2Owner{projectV2(number:$n){id}}} resource(url:$u){... on Issue{id}}}`;
const ADD = `mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}`;

interface Reply<T> {
  data?: T;
  errors?: { message: string }[];
}

async function call<T>(token: string, query: string, variables: Record<string, unknown>, fetchImpl: Fetch): Promise<T> {
  const response = await fetchImpl(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 401) throw new NoticeError({ code: 'github.err.unauthorized' });
  const body = (await response.json()) as Reply<T>;
  if (!response.ok) throw new NoticeError({ code: 'github.err.http', args: { status: response.status } });
  if (body.errors?.length) throw new NoticeError({ code: 'github.err.raw', args: { detail: body.errors.map((e) => e.message).join('; ') } });
  if (!body.data) throw new NoticeError({ code: 'github.err.no-data' });
  return body.data;
}

/**
 * Adds an existing Issue to the central Project. It needs the `project` scope. A failure throws an
 * Error whose message says what GitHub answered, so the caller can report it as it is.
 */
export async function addIssueToProject(
  token: string,
  project: { owner: string; number: number },
  issueUrl: string,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<void> {
  const found = await call<{ repositoryOwner: { projectV2?: { id: string } | null } | null; resource: { id?: string } | null }>(
    token,
    LOOKUP,
    { o: project.owner, n: project.number, u: issueUrl },
    fetchImpl,
  );
  const projectId = found.repositoryOwner?.projectV2?.id;
  if (!projectId) throw new NoticeError({ code: 'github.err.project-not-found', args: { number: project.number, owner: project.owner } });
  const contentId = found.resource?.id;
  if (!contentId) throw new NoticeError({ code: 'github.err.not-an-issue', args: { url: issueUrl } });
  await call(token, ADD, { p: projectId, c: contentId }, fetchImpl);
}

export interface NewIssue {
  title: string;
  body: string;
  labels: string[];
}

/** Creates an Issue and returns its number and address. It needs the `repo` scope. */
export async function createIssue(
  token: string,
  repository: string,
  issue: NewIssue,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<{ number: number; url: string }> {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
  if (response.status === 401) throw new NoticeError({ code: 'github.err.unauthorized' });
  const body = (await response.json()) as { number?: number; html_url?: string; message?: string };
  if (!response.ok) throw new NoticeError(body.message ? { code: 'github.err.http-detail', args: { status: response.status, detail: body.message } } : { code: 'github.err.http', args: { status: response.status } });
  if (typeof body.number !== 'number' || typeof body.html_url !== 'string') throw new NoticeError({ code: 'github.err.no-issue' });
  return { number: body.number, url: body.html_url };
}
