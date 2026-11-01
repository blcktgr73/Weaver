import type { Fetch } from './project';

const API = 'https://api.github.com/graphql';

interface Reply {
  data?: Record<string, { diskUsage: number | null } | null>;
}

/**
 * The size on GitHub of each repository, in kilobytes, keyed by the name as given. The size only
 * helps a person choose what to clone, so any failure returns what was read (maybe nothing) and
 * the caller shows no size.
 */
export async function readRepositorySizes(
  token: string,
  repositories: readonly string[],
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  const named = repositories.map((repository, index) => ({ repository, index, parts: repository.split('/') })).filter((r) => r.parts.length === 2 && r.parts[0] && r.parts[1]);
  if (named.length === 0) return sizes;
  // Owner and name travel as variables, never inside the query text.
  const declarations = named.map((r) => `$o${r.index}:String!,$n${r.index}:String!`).join(',');
  const fields = named.map((r) => `r${r.index}:repository(owner:$o${r.index},name:$n${r.index}){diskUsage}`).join(' ');
  const variables = Object.fromEntries(named.flatMap((r) => [[`o${r.index}`, r.parts[0]], [`n${r.index}`, r.parts[1]]]));
  try {
    const response = await fetchImpl(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query(${declarations}){${fields}}`, variables }),
    });
    // A repository that cannot be read comes back as an error and a null; the others still carry data.
    const body = (await response.json()) as Reply;
    for (const r of named) {
      const size = body.data?.[`r${r.index}`]?.diskUsage;
      if (typeof size === 'number') sizes.set(r.repository, size);
    }
  } catch {
    // No sizes: the list is shown without them.
  }
  return sizes;
}
