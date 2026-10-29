import * as vscode from 'vscode';
import { IssueSnapshot, parseIssueUrl } from '@palab/weaver-markdown';

export type IssueResult = { ok: true; issue: IssueSnapshot } | { ok: false; error: string };

/**
 * Uses VS Code's built-in GitHub sign-in. Read-only: Weaver never writes to GitHub here.
 * `interactive: false` returns a token only when the user is already signed in.
 */
export async function getGitHubToken(interactive: boolean): Promise<string | undefined> {
  const session = await vscode.authentication.getSession(
    'github',
    ['repo'],
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
