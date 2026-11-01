import * as vscode from 'vscode';
import { Contributor, formatNotice, parseProjectRef, serializeConfig, type UserConfig } from '@palab/weaver-markdown';
import { listProjects, readProject, summarizeProject } from '@palab/weaver-github';
import { getGitHubToken } from './github';
import { currentLocale, message } from './locale';
import { readUserConfig, userConfigPath, writeUserConfig } from './userConfig';

type Project = { owner: string; number: number };

const same = (a: Project, b: Project): boolean => a.owner.toLowerCase() === b.owner.toLowerCase() && a.number === b.number;

/**
 * "Weaver: Set Up": the steps of `weaver init` in the editor (DEC-014). Sign in with VS Code, pick
 * the Project, untick the repositories to leave out, add people and agents to the roster, then
 * show the file and write it only after a yes. Running it again starts from what is there.
 * Returns true when the file was written.
 */
export async function setUp(): Promise<boolean> {
  const locale = currentLocale();
  const fail = (detail: string): boolean => {
    void vscode.window.showErrorMessage(message('ui.setup.failed', { detail }));
    return false;
  };

  const token = await getGitHubToken(true, ['repo', 'project']);
  if (!token) {
    void vscode.window.showWarningMessage(message('ui.setup.sign-in-failed'));
    return false;
  }
  const existing = await readUserConfig();
  const current: UserConfig | undefined = existing.kind === 'ok' ? existing.config : undefined;

  // 1. The Project.
  const listed = await listProjects(token);
  if (!listed.ok) return fail(formatNotice(listed.error, locale));
  if (listed.organizationsSkipped) void vscode.window.showInformationMessage(message('ui.setup.organizations-skipped'));
  type ProjectItem = vscode.QuickPickItem & { project?: Project };
  const items: ProjectItem[] = listed.projects.map((p) => ({
    label: `${p.owner} #${p.number}  ${p.title}`,
    description: [message('ui.setup.items', { items: p.items }), p.closed ? message('ui.setup.closed') : '', current && same(current.project, p) ? message('ui.setup.current') : ''].filter(Boolean).join(' · '),
    project: { owner: p.owner, number: p.number },
  }));
  items.push({ label: message('ui.setup.project-other'), alwaysShow: true });
  const pickedProject = await vscode.window.showQuickPick(items, { placeHolder: message('ui.setup.project-placeholder'), ignoreFocusOut: true });
  if (!pickedProject) return false;
  let project = pickedProject.project;
  if (!project) {
    const typed = await vscode.window.showInputBox({
      prompt: message('ui.setup.project-prompt'),
      ignoreFocusOut: true,
      validateInput: (text) => (parseProjectRef(text) ? undefined : message('ui.setup.project-bad')),
    });
    project = typed === undefined ? undefined : parseProjectRef(typed);
    if (!project) return false;
  }

  // 2. The repositories on it.
  const chosenProject = project;
  const read = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: message('ui.setup.reading', { owner: chosenProject.owner, number: chosenProject.number }) }, () =>
    readProject(token, chosenProject, undefined),
  );
  if (!read.ok) return fail(formatNotice(read.error, locale));
  const overview = summarizeProject(read.read);

  const kept = new Set(current?.repositories?.map((r) => r.repository.toLowerCase()));
  const repositoryItems = overview.repositories.map((r) => ({
    label: r.repository,
    description: message('ui.setup.cards', { cards: r.cards }),
    picked: !current?.repositories || kept.has(r.repository.toLowerCase()),
  }));
  const chosenRepositories = await vscode.window.showQuickPick(repositoryItems, { canPickMany: true, placeHolder: message('ui.setup.repositories-placeholder'), ignoreFocusOut: true });
  if (!chosenRepositories) return false;
  if (chosenRepositories.length === 0) {
    void vscode.window.showWarningMessage(message('ui.setup.no-repositories'));
    return false;
  }
  // Everything ticked is the same as no list: the Overview then follows the Project (DEC-014).
  const repositories = chosenRepositories.length === repositoryItems.length ? undefined : chosenRepositories.map((r) => ({ repository: r.label }));

  // 3. The roster: who is in it, people found on the cards, and agents by hand.
  const contributors: Contributor[] = [...(current?.roster?.contributors ?? [])];
  const known = new Set(contributors.flatMap((c) => [c.id.toLowerCase(), c.github?.toLowerCase() ?? '']));
  const candidates = overview.assignees.filter((a) => !known.has(a.login.toLowerCase()));
  if (candidates.length) {
    const people = await vscode.window.showQuickPick(
      candidates.map((a) => ({ label: a.login, description: message('ui.setup.cards', { cards: a.cards }) })),
      { canPickMany: true, placeHolder: message('ui.setup.assignees-placeholder'), ignoreFocusOut: true },
    );
    if (!people) return false;
    for (const person of people) contributors.push({ id: person.label, kind: 'human', github: person.label });
  }
  for (;;) {
    const id = (await vscode.window.showInputBox({ prompt: message('ui.setup.agent-prompt'), ignoreFocusOut: true }))?.trim();
    if (!id) break;
    if (contributors.some((c) => c.id.toLowerCase() === id.toLowerCase())) {
      void vscode.window.showWarningMessage(message('ui.setup.agent-duplicate', { id }));
      continue;
    }
    const tool = (await vscode.window.showInputBox({ prompt: message('ui.setup.agent-tool-prompt', { id }), ignoreFocusOut: true }))?.trim();
    const reach = (await vscode.window.showInputBox({ prompt: message('ui.setup.agent-reach-prompt', { id }), ignoreFocusOut: true }))?.trim();
    contributors.push({ id, kind: 'agent', ...(tool ? { tool } : {}), ...(reach ? { reach } : {}) });
  }

  // 4. Show it, and write it only after a yes.
  const config: UserConfig = { project, ...(repositories ? { repositories } : {}), ...(contributors.length ? { roster: { contributors } } : {}) };
  const text = serializeConfig(config);
  const file = userConfigPath();
  const replacing = existing.kind === 'ok' ? existing.text : undefined;
  const detail = `${text}${replacing?.trim() ? `\n${message('ui.setup.replace-note', { backup: `${file}.bak` })}` : ''}`;
  const writeLabel = message('ui.setup.write-button');
  const choice = await vscode.window.showInformationMessage(message('ui.setup.preview-title', { path: file }), { modal: true, detail }, writeLabel);
  if (choice !== writeLabel) return false;

  try {
    await writeUserConfig(text, replacing);
  } catch (error) {
    return fail((error as Error).message);
  }
  void vscode.window.showInformationMessage(message('ui.setup.written', { path: file }));
  return true;
}
