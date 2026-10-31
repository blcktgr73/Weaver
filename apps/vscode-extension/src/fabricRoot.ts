import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { cloneUrl, DirectoryKind, planClones } from '@palab/weaver-markdown';
import { message } from './locale';
import { readRegistry } from './overviewView';

const SETTING = 'weaver.fabricRoot';

/** The local folder that holds the clones. It is a machine setting, never written to the repository. */
export function fabricRoot(): string | undefined {
  const value = vscode.workspace.getConfiguration('weaver').get<string>('fabricRoot')?.trim();
  return value ? value : undefined;
}

export async function setFabricRoot(): Promise<string | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: message('ui.fabric.root-button'),
    title: message('ui.fabric.root-prompt'),
    defaultUri: fabricRoot() ? vscode.Uri.file(fabricRoot() as string) : undefined,
  });
  const folder = picked?.[0]?.fsPath;
  if (!folder) return undefined;
  await vscode.workspace.getConfiguration('weaver').update(SETTING, folder, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(message('ui.fabric.root-set', { root: folder }));
  return folder;
}

async function kindOf(directory: string): Promise<DirectoryKind | undefined> {
  try {
    if (!(await fs.stat(directory)).isDirectory()) return 'other';
  } catch {
    return undefined;
  }
  try {
    await fs.stat(path.join(directory, '.git'));
    return 'repository';
  } catch {
    return 'other';
  }
}

/** `git clone`, never through a shell and never waiting for a password prompt. */
function gitClone(url: string, directory: string): Promise<{ ok: true } | { ok: false; detail: string; gitMissing?: boolean }> {
  return new Promise((resolve) => {
    execFile('git', ['clone', url, directory], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 10 * 60 * 1000 }, (error, _stdout, stderr) => {
      if (!error) return resolve({ ok: true });
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return resolve({ ok: false, detail: '', gitMissing: true });
      const lines = `${stderr}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      resolve({ ok: false, detail: lines[lines.length - 1] ?? error.message });
    });
  });
}

/**
 * Clones every registered repository that is missing under the fabric root. The user picks
 * what to clone first; an existing folder is never touched, and one failure does not stop the rest.
 */
export async function cloneRegistered(): Promise<void> {
  const registry = await readRegistry();
  if (registry.kind !== 'ok') {
    void vscode.window.showWarningMessage(message('ui.fabric.no-registry'));
    return;
  }
  let root = fabricRoot();
  if (!root) {
    void vscode.window.showInformationMessage(message('ui.fabric.root-missing'));
    root = await setFabricRoot();
    if (!root) return;
  }

  const repositories = registry.registry.repositories.map((r) => r.repository);
  const present = new Map<string, DirectoryKind>();
  for (const item of planClones(repositories, new Map())) {
    const kind = await kindOf(path.join(root, item.directory));
    if (kind) present.set(item.directory, kind);
  }
  const items = planClones(repositories, present);
  const missing = items.filter((item) => item.state === 'missing');
  const already = items.filter((item) => item.state === 'present').length;

  if (missing.length === 0) {
    void vscode.window.showInformationMessage(message('ui.fabric.nothing-to-clone', { root }));
    return;
  }

  const picked = await vscode.window.showQuickPick(
    items.map((item) => ({
      label: item.repository,
      description: item.state === 'not-a-repository' ? message('ui.fabric.pick-item-exists') : item.directory,
      picked: item.state === 'missing',
      item,
    })).filter((row) => row.item.state !== 'present'),
    { canPickMany: true, placeHolder: message('ui.fabric.pick', { root }) },
  );
  if (!picked) return;
  const chosen = picked.map((row) => row.item).filter((item) => item.state === 'missing');
  const skipped = missing.length - chosen.length;

  let cloned = 0;
  const failures: string[] = [];
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: false }, async (progress) => {
    for (const [index, item] of chosen.entries()) {
      progress.report({ message: message('ui.fabric.cloning', { repository: item.repository, done: index + 1, total: chosen.length }) });
      const result = await gitClone(cloneUrl(item.repository), path.join(root as string, item.directory));
      if (result.ok) cloned += 1;
      else if (result.gitMissing) {
        void vscode.window.showErrorMessage(message('ui.fabric.git-missing'));
        return;
      } else failures.push(message('ui.fabric.failed', { repository: item.repository, detail: result.detail }));
    }
  });

  const summary = message('ui.fabric.summary', { cloned, present: already, skipped, failed: failures.length });
  const open = message('ui.fabric.open-button');
  if (failures.length) {
    const details = message('ui.fabric.show-failures');
    const choice = await vscode.window.showWarningMessage(summary, details);
    if (choice === details) void vscode.window.showWarningMessage(failures.join('\n'), { modal: true });
    return;
  }
  const choice = await vscode.window.showInformationMessage(`${summary} ${message('ui.fabric.open-offer', { root })}`, open);
  if (choice === open) await openFabricRoot();
}

export async function openFabricRoot(): Promise<void> {
  const root = fabricRoot();
  if (!root) {
    void vscode.window.showInformationMessage(message('ui.fabric.root-missing'));
    return;
  }
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(root), { forceNewWindow: true });
}
