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
 * Adds an existing Issue to the central Project and returns the id of its card. Adding an Issue that is
 * already there returns the card it has. It needs the `project` scope. A failure throws an
 * Error whose message says what GitHub answered, so the caller can report it as it is.
 */
export async function addIssueToProject(
  token: string,
  project: { owner: string; number: number },
  issueUrl: string,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<string | undefined> {
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
  const added = await call<{ addProjectV2ItemById?: { item?: { id?: string } } }>(token, ADD, { p: projectId, c: contentId }, fetchImpl);
  return added.addProjectV2ItemById?.item?.id;
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

const FIELD = `query($o:String!,$n:Int!,$f:String!){repositoryOwner(login:$o){... on ProjectV2Owner{projectV2(number:$n){id field(name:$f){__typename ... on ProjectV2Field{id dataType} ... on ProjectV2SingleSelectField{id options{id name}}}}}}}`;
const SET_TEXT = `mutation($p:ID!,$i:ID!,$f:ID!,$v:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{text:$v}}){projectV2Item{id}}}`;
const SET_OPTION = `mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}`;

/**
 * Sets a text or single-select field of a Project card, by the name of the field (DEC-016 item 6).
 * A field that does not exist, is of another type, or has no such option throws a notice error, and
 * nothing is changed. It needs the `project` scope.
 */
export async function setProjectField(
  token: string,
  project: { owner: string; number: number },
  itemId: string,
  fieldName: string,
  value: string,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<void> {
  type Field = { __typename: string; id?: string; dataType?: string; options?: { id: string; name: string }[] } | null;
  const found = await call<{ repositoryOwner: { projectV2?: { id: string; field: Field } | null } | null }>(token, FIELD, { o: project.owner, n: project.number, f: fieldName }, fetchImpl);
  const board = found.repositoryOwner?.projectV2;
  if (!board) throw new NoticeError({ code: 'github.err.project-not-found', args: { number: project.number, owner: project.owner } });
  const field = board.field;
  if (!field?.id) throw new NoticeError({ code: 'github.err.project-field-not-found', args: { field: fieldName, number: project.number, owner: project.owner } });
  if (field.options) {
    const option = field.options.find((o) => o.name === value);
    if (!option) throw new NoticeError({ code: 'github.err.project-field-no-option', args: { field: fieldName, value } });
    await call(token, SET_OPTION, { p: board.id, i: itemId, f: field.id, o: option.id }, fetchImpl);
    return;
  }
  if (field.dataType !== 'TEXT') throw new NoticeError({ code: 'github.err.project-field-type', args: { field: fieldName } });
  await call(token, SET_TEXT, { p: board.id, i: itemId, f: field.id, v: value }, fetchImpl);
}