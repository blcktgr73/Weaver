import * as vscode from 'vscode';
import { formatNotice, setRepositories } from '@palab/weaver-markdown';
import { readProject } from '@palab/weaver-github';
import { getGitHubToken } from './github';
import { currentLocale, message } from './locale';
import { readRegistry } from './overviewView';
import { readUserConfig, userConfigPath, writeUserConfig } from './userConfig';

/** Opens the personal configuration file, or says that there is none yet. */
export async function openConfigFile(): Promise<void> {
  const file = userConfigPath();
  const exists = await vscode.workspace.fs.stat(vscode.Uri.file(file)).then(() => true, () => false);
  if (!exists) {
    void vscode.window.showInformationMessage(message('ui.repos.no-config-file'));
    return;
  }
  await vscode.window.showTextDocument(vscode.Uri.file(file));
}

/**
 * Lets a person choose which repositories of the Project the Overview shows. Only the `repositories`
 * list of the personal configuration changes, after the change has been shown and confirmed; the old
 * file is kept as `config.yaml.bak` (DEC-014).
 */
export async function chooseRepositories(): Promise<boolean> {
  const registry = await readRegistry();
  if (registry.kind === 'ok' && registry.source === 'workspace') {
    const open = message('ui.repos.open-fabric');
    const choice = await vscode.window.showInformationMessage(message('ui.repos.from-workspace'), open);
    if (choice === open) {
      const [uri] = await vscode.workspace.findFiles('fabric.yaml', '**/{node_modules,.git}/**', 1);
      if (uri) await vscode.window.showTextDocument(uri);
    }
    return false;
  }

  const user = await readUserConfig();
  if (user.kind === 'none') {
    void vscode.window.showInformationMessage(message('ui.repos.no-config'));
    return false;
  }
  if (user.kind === 'invalid') {
    const open = message('ui.repos.open-config');
    const choice = await vscode.window.showWarningMessage(message('ui.repos.invalid-config', { path: user.path }), open);
    if (choice === open) await openConfigFile();
    return false;
  }

  const token = await getGitHubToken(true, ['repo', 'project']);
  if (!token) {
    void vscode.window.showInformationMessage(message('ui.repos.sign-in'));
    return false;
  }
  const read = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: message('ui.repos.reading') },
    () => readProject(token, user.config.project, undefined),
  );
  if (!read.ok) {
    void vscode.window.showWarningMessage(message('ui.repos.read-failed', { detail: formatNotice(read.error, currentLocale()) }));
    return false;
  }

  // Every repository the Project has cards of, and any listed one that has none yet.
  const counts = new Map<string, { name: string; cards: number }>();
  for (const card of read.read.cards) {
    const key = card.repository.toLowerCase();
    counts.set(key, { name: counts.get(key)?.name ?? card.repository, cards: (counts.get(key)?.cards ?? 0) + 1 });
  }
  const current = user.config.repositories?.map((r) => r.repository);
  for (const name of current ?? []) if (!counts.has(name.toLowerCase())) counts.set(name.toLowerCase(), { name, cards: 0 });
  const shown = new Set((current ?? [...counts.values()].map((c) => c.name)).map((name) => name.toLowerCase()));

  const rows = [...counts.values()].sort((a, b) => b.cards - a.cards || a.name.localeCompare(b.name));
  const picked = await vscode.window.showQuickPick(
    rows.map((row) => ({ label: row.name, description: message('ui.repos.cards', { count: row.cards }), picked: shown.has(row.name.toLowerCase()), name: row.name })),
    { canPickMany: true, placeHolder: message('ui.repos.placeholder'), ignoreFocusOut: true },
  );
  if (!picked) return false;
  if (picked.length === 0) {
    void vscode.window.showWarningMessage(message('ui.repos.none-picked'));
    return false;
  }

  // Everything ticked means no list, so the Overview follows the Project (the same rule as the setup).
  const all = picked.length === rows.length;
  // The listed order stays; repositories that are new to the list follow.
  const kept = (current ?? []).filter((name) => picked.some((p) => p.name.toLowerCase() === name.toLowerCase()));
  const added = picked.map((p) => p.name).filter((name) => !kept.some((k) => k.toLowerCase() === name.toLowerCase()));
  const wanted = all ? undefined : [...kept, ...added];

  const same = wanted === undefined ? current === undefined : current !== undefined && wanted.length === current.length && wanted.every((name, index) => name.toLowerCase() === current[index].toLowerCase());
  if (same) {
    void vscode.window.showInformationMessage(message('ui.repos.unchanged'));
    return false;
  }

  const write = message('ui.repos.write');
  const answer = await vscode.window.showInformationMessage(
    wanted ? message('ui.repos.confirm', { count: wanted.length, path: user.path }) : message('ui.repos.confirm-all', { path: user.path }),
    { modal: true, detail: message('ui.repos.confirm-detail', { list: (wanted ?? rows.map((r) => r.name)).map((name) => `• ${name}`).join('\n') }) },
    write,
  );
  if (answer !== write) return false;

  const file = await writeUserConfig(setRepositories(user.text, wanted), user.text);
  void vscode.window.showInformationMessage(message('ui.repos.written', { path: file }));
  return true;
}
