import type { MergedPull, Notice } from '@palab/weaver-markdown';
import type { Fetch } from './project';

export type PullsResult = { ok: true; pulls: MergedPull[] } | { ok: false; error: Notice };

const API = 'https://api.github.com/graphql';

const QUERY = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequests(states:MERGED,first:$n,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number title url headRefName closingIssuesReferences(first:5){nodes{number}}}}}}`;

interface Reply {
  data?: {
    repository: null | {
      pullRequests: {
        nodes: {
          number: number;
          title: string;
          url: string;
          headRefName: string;
          closingIssuesReferences: { nodes: { number: number }[] };
        }[];
      };
    };
  };
  errors?: { message: string }[];
}

/**
 * The most recently merged pull requests of one repository, with the Issues each one closes.
 * It only feeds a check, so any failure comes back as one notice naming the repository and
 * the caller skips that check instead of failing the whole Overview.
 */
export async function readMergedPulls(
  token: string,
  repository: string,
  limit = 50,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<PullsResult> {
  const failed: PullsResult = { ok: false, error: { code: 'pulls.failed', args: { repository } } };
  const [owner, name] = repository.split('/');
  if (!owner || !name) return failed;
  try {
    const response = await fetchImpl(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { o: owner, r: name, n: limit } }),
    });
    const body = (await response.json()) as Reply;
    const found = body.data?.repository;
    if (!response.ok || body.errors?.length || !found) return failed;
    return {
      ok: true,
      pulls: found.pullRequests.nodes.map((pull) => ({
        repository,
        number: pull.number,
        title: pull.title,
        url: pull.url,
        branch: pull.headRefName,
        closes: pull.closingIssuesReferences.nodes.map((issue) => issue.number),
      })),
    };
  } catch {
    return failed;
  }
}
