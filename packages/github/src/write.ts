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
  if (response.status === 401) throw new Error('GitHub rejected the sign-in (401).');
  const body = (await response.json()) as Reply<T>;
  if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  if (!body.data) throw new Error('GitHub sent no data.');
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
  if (!projectId) throw new Error(`Project ${project.number} of ${project.owner} was not found, or this sign-in cannot see it.`);
  const contentId = found.resource?.id;
  if (!contentId) throw new Error(`${issueUrl} is not an Issue that this sign-in can see.`);
  await call(token, ADD, { p: projectId, c: contentId }, fetchImpl);
}
