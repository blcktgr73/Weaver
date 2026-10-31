import * as vscode from 'vscode';

export {
  applyMove,
  fetchBoardItems,
  fetchEvidence,
  fetchIssue,
  type EvidenceResult,
  type IssueResult,
  type MoveStep,
} from '@palab/weaver-github';

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
