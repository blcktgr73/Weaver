import type { System } from './contract';

export interface FilesPullRequest {
  system: System;
  /** The folder that holds the repository's files in the user's checkout. */
  root: string;
  repository: string;
  branch: string;
  title: string;
  body: string;
  commitMessage: string;
  /** Changes the files inside the new worktree. `top` is the checkout's top-level folder, `base` the default branch. */
  edit(worktree: { work: string; top: string; base: string }): Promise<void>;
}

/**
 * Offers a change to repository files as a pull request. The change is made in a separate worktree
 * on a new branch cut from the default branch, so the user's own checkout and the default branch
 * stay untouched; the worktree is removed afterwards, whether it worked or not.
 */
export async function openFilesPullRequest(input: FilesPullRequest): Promise<void> {
  const { system } = input;
  const top = (await system.run('git', ['rev-parse', '--show-toplevel'], { cwd: input.root })).trim();
  const base = (await system.run('gh', ['repo', 'view', input.repository, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'])).trim();
  await system.run('git', ['fetch', 'origin', base], { cwd: top });
  const work = await system.tempDir();
  try {
    await system.run('git', ['worktree', 'add', '-b', input.branch, work, `origin/${base}`], { cwd: top });
    await input.edit({ work, top, base });
    await system.run('git', ['add', '-A'], { cwd: work });
    await system.run('git', ['commit', '-m', input.commitMessage], { cwd: work });
    await system.run('git', ['push', '-u', 'origin', input.branch], { cwd: work });
    await system.run('gh', ['pr', 'create', '--repo', input.repository, '--head', input.branch, '--base', base, '--title', input.title, '--body', input.body]);
  } finally {
    await system.run('git', ['worktree', 'remove', '--force', work], { cwd: top }).catch(() => undefined);
  }
}

/** True when a pull request from `branch` is already open, so the same change is not offered twice. */
export async function pullRequestOpen(system: System, repository: string, branch: string): Promise<boolean> {
  try {
    const listed = JSON.parse(await system.run('gh', ['pr', 'list', '--repo', repository, '--state', 'open', '--limit', '100', '--json', 'headRefName'])) as { headRefName?: string }[];
    return listed.some((pull) => pull.headRefName === branch);
  } catch {
    // Without the list there is nothing to compare with; the person still confirms the action.
    return false;
  }
}
