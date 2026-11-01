import * as os from 'os';
import * as path from 'path';
import { Locale, parseConfig, parseFabric, resolveSetup, Setup, t, ValidationIssue, validationKey, type UserConfig, type FabricRegistry } from '@palab/weaver-markdown';
import type { Deps } from './contract';

/** `~/.weaver/config.yaml`, or under `WEAVER_HOME`. Never inside a repository (DEC-014). */
export function configPath(env: Record<string, string | undefined>): string {
  return path.join(env.WEAVER_HOME ?? path.join(os.homedir(), '.weaver'), 'config.yaml');
}

export type SetupResult = { ok: true; setup: Setup } | { ok: false; reason: 'none' } | { ok: false; reason: 'invalid'; path: string; detail: string };

const firstError = (issues: readonly ValidationIssue[], locale: Locale): string => {
  const issue = issues.find((i) => i.severity === 'error') ?? issues[0];
  return issue ? t(validationKey(issue.code), locale, issue.args) : '';
};

/**
 * The Project and repositories to work from: the workspace `fabric.yaml` when it exists, else the
 * personal configuration (DEC-014). A file that exists but cannot be read is reported rather than
 * skipped, so a typo does not quietly fall back to something else.
 */
export async function loadSetup(root: string, deps: Pick<Deps, 'env' | 'readText'>, locale: Locale): Promise<SetupResult> {
  const workspaceFile = path.join(root, 'fabric.yaml');
  const workspaceText = await deps.readText(workspaceFile);
  let workspace: FabricRegistry | undefined;
  if (workspaceText !== undefined && workspaceText.trim() !== '') {
    const parsed = parseFabric(workspaceFile, workspaceText);
    if (!parsed.registry) return { ok: false, reason: 'invalid', path: workspaceFile, detail: firstError(parsed.issues, locale) };
    workspace = parsed.registry;
  }

  const userFile = configPath(deps.env);
  const userText = await deps.readText(userFile);
  let user: UserConfig | undefined;
  if (userText !== undefined && userText.trim() !== '') {
    const parsed = parseConfig(userFile, userText);
    if (!parsed.config) {
      // A broken personal file only matters when the workspace file does not decide everything.
      if (!workspace) return { ok: false, reason: 'invalid', path: userFile, detail: firstError(parsed.issues, locale) };
    } else {
      user = parsed.config;
    }
  }

  const setup = resolveSetup(workspace, user);
  return setup ? { ok: true, setup } : { ok: false, reason: 'none' };
}
