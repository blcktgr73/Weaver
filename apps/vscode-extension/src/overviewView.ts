import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  buildLanes,
  FabricRegistry,
  findMismatches,
  MergedPull,
  normalizeIssueUrl,
  Notice,
  parseFabric,
  RequirementLink,
  requirementsByIssue,
  ValidationIssue,
} from '@palab/weaver-markdown';
import { ProjectCard, ProjectRead, readMergedPulls, readProject } from '@palab/weaver-github';
import { fetchEvidence, getGitHubToken } from './github';
import { currentLocale, message as text } from './locale';
import { OverviewCard, OverviewState, renderOverviewHtml } from './overviewHtml';
import { isOpenableUrl } from './requirementHtml';
import { REQUIREMENT_EDITOR } from './requirementEditor';
import type { RequirementView } from './requirementView';
import { Loaded } from './workspace';

const REGISTRY_FILE = 'fabric.yaml';
const HIDDEN_KEY = 'weaver.overview.hiddenProjects';
const COLLAPSED_KEY = 'weaver.overview.collapsedProjects';

type Registry =
  | { kind: 'none' }
  | { kind: 'invalid'; issues: ValidationIssue[] }
  | { kind: 'ok'; registry: FabricRegistry };

/** Reads `fabric.yaml` at the root of the workspace (DEC-010). */
export async function readRegistry(): Promise<Registry> {
  const [uri] = await vscode.workspace.findFiles(REGISTRY_FILE, '**/{node_modules,.git}/**', 1);
  if (!uri) return { kind: 'none' };
  const text = new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
  const result = parseFabric(vscode.workspace.asRelativePath(uri, false), text);
  return result.registry ? { kind: 'ok', registry: result.registry } : { kind: 'invalid', issues: result.issues };
}

/** The Overview Kanban: one lane per registered repository, columns by stage, cards linked to requirements (REQ-006). */
export class OverviewView {
  private panel: vscode.WebviewPanel | undefined;
  private loaded: Loaded | undefined;
  private registry: Registry = { kind: 'none' };
  private read: ProjectRead | undefined;
  private phase: 'sign-in' | 'loading' | 'error' | 'ready' = 'loading';
  private error: Notice | undefined;
  /** Newest request wins, so a slow answer cannot overwrite a newer one. */
  private request = 0;
  /** Recently merged pull requests, and the checks that could not read them. */
  private pulls: MergedPull[] = [];
  private skippedChecks: Notice[] = [];
  /** Which projects are shown and which lanes are folded. Stored on this computer, never in the repository. */
  private hidden: Set<string>;
  private collapsed: Set<string>;

  constructor(
    private readonly store: vscode.Memento,
    private readonly requirements: RequirementView,
  ) {
    this.hidden = new Set(store.get<string[]>(HIDDEN_KEY, []));
    this.collapsed = new Set(store.get<string[]>(COLLAPSED_KEY, []));
  }

  private flip(set: Set<string>, key: string, id: string): void {
    if (!set.delete(id)) set.add(id);
    void this.store.update(key, [...set]);
    this.render();
  }

  async show(loaded: Loaded): Promise<void> {
    this.loaded = loaded;
    if (this.panel) {
      this.panel.reveal();
    } else {
      this.panel = vscode.window.createWebviewPanel('weaver.overview', 'Weaver', vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });
      this.panel.onDidDispose(() => (this.panel = undefined));
      this.panel.webview.onDidReceiveMessage((message: { type: string; url?: string; id?: string; path?: string }) => this.onMessage(message));
    }
    await this.load(false);
  }

  /** The workspace was re-read: requirement links may have changed. */
  update(loaded: Loaded): void {
    this.loaded = loaded;
    if (this.panel) this.render();
  }

  private async onMessage(message: { type: string; url?: string; id?: string; path?: string }): Promise<void> {
    if (message.type === 'signIn') await this.load(true);
    else if (message.type === 'refresh') await this.load(false);
    else if (message.type === 'toggleLane' && message.id) this.flip(this.hidden, HIDDEN_KEY, message.id);
    else if (message.type === 'foldLane' && message.id) this.flip(this.collapsed, COLLAPSED_KEY, message.id);
    else if (message.type === 'showAll') {
      this.hidden.clear();
      void this.store.update(HIDDEN_KEY, []);
      this.render();
    }
    else if (message.type === 'openCard' && message.url) await this.openCard(message.url);
    else if (message.type === 'openFile' && message.path) {
      const uri = this.loaded?.uris.get(message.path);
      if (uri) await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Beside });
    }
    else if (message.type === 'cardMenu' && message.url) await this.cardMenu(message.url);
    else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
      await vscode.env.openExternal(vscode.Uri.parse(message.url));
    } else if (message.type === 'openRequirement' && message.id) {
      const requirement = this.loaded?.artifacts.find((a) => a.kind === 'requirement' && a.id === message.id);
      const uri = requirement && this.loaded?.uris.get(requirement.path);
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, REQUIREMENT_EDITOR, vscode.ViewColumn.Beside);
    }
  }

  private find(url: string): { card: ProjectCard; link?: RequirementLink } | undefined {
    const wanted = normalizeIssueUrl(url);
    const card = this.read?.cards.find((c) => normalizeIssueUrl(c.url) === wanted);
    if (!card) return undefined;
    return { card, link: requirementsByIssue(this.loaded?.artifacts ?? []).get(wanted) };
  }

  /** The main action of a card: its requirement scrolled to the task, or the Issue when no file is visible. */
  private async openCard(url: string): Promise<void> {
    const found = this.find(url);
    if (!found) return;
    const { card, link } = found;
    const requirement = link && this.loaded?.artifacts.find((a) => a.kind === 'requirement' && a.id === link.id);
    if (link && requirement?.kind === 'requirement' && this.loaded) {
      this.requirements.show(this.loaded, requirement, link.taskId);
    } else if (isOpenableUrl(card.url)) {
      await vscode.env.openExternal(vscode.Uri.parse(card.url));
    }
  }

  /** Every place a card can lead to. A place that cannot open says why instead of disappearing. */
  private async cardMenu(url: string): Promise<void> {
    const found = this.find(url);
    if (!found) return;
    const { card, link } = found;
    const loaded = this.loaded;
    type Item = vscode.QuickPickItem & { run?: () => Thenable<unknown> | void; reason?: string };
    const unavailable = (label: string, reason: string): Item => ({
      label: `$(circle-slash) ${label}`,
      description: text('ui.overview.menu.unavailable'),
      detail: reason,
      reason,
    });
    const task = link?.taskId ?? card.taskId ?? card.title;

    const taskLabel = text('ui.overview.menu.task-file', { task });
    const taskUri = link?.taskPath ? loaded?.uris.get(link.taskPath) : undefined;
    const requirementUri = link ? loaded?.uris.get(link.path) : undefined;
    const folder = vscode.workspace.workspaceFolders?.find((f) => {
      const name = card.repository.split('/')[1].toLowerCase();
      return f.name.toLowerCase() === name || f.uri.path.toLowerCase().endsWith(`/${name}`);
    });

    const items: Item[] = [
      taskUri
        ? { label: `$(file) ${taskLabel}`, detail: link?.taskPath, run: () => vscode.window.showTextDocument(taskUri, { viewColumn: vscode.ViewColumn.Beside }) }
        : unavailable(taskLabel, link ? text('ui.overview.na.no-task-file', { task }) : text('ui.overview.na.no-requirement')),
      link && requirementUri
        ? {
            label: `$(markdown) ${text('ui.overview.menu.requirement-source', { id: link.id })}`,
            detail: link.path,
            run: () => vscode.commands.executeCommand('vscode.openWith', requirementUri, 'default', vscode.ViewColumn.Beside),
          }
        : unavailable(text('ui.overview.menu.requirement-source', { id: link?.id ?? '' }).trim(), text('ui.overview.na.no-requirement')),
      {
        label: `$(link-external) ${text('ui.overview.menu.issue', { number: card.number })}`,
        detail: card.url,
        run: () => (isOpenableUrl(card.url) ? vscode.env.openExternal(vscode.Uri.parse(card.url)) : undefined),
      },
      { label: `$(git-pull-request) ${text('ui.overview.menu.pull-request')}`, run: () => this.openPullRequest(card) },
      folder
        ? { label: `$(folder) ${text('ui.overview.menu.repository-folder', { repository: card.repository })}`, run: () => vscode.commands.executeCommand('revealInExplorer', folder.uri) }
        : unavailable(text('ui.overview.menu.repository-folder', { repository: card.repository }), text('ui.overview.na.no-folder', { repository: card.repository })),
    ];

    const picked = await vscode.window.showQuickPick(items, { placeHolder: text('ui.overview.menu.placeholder') });
    if (!picked) return;
    if (picked.reason) void vscode.window.showInformationMessage(picked.reason);
    else await picked.run?.();
  }

  private async openPullRequest(card: ProjectCard): Promise<void> {
    const token = await getGitHubToken(false, ['repo', 'project']);
    if (!token) {
      void vscode.window.showInformationMessage(text('ui.overview.na.sign-in'));
      return;
    }
    const result = await fetchEvidence(token, card.url);
    if (!result.ok) {
      void vscode.window.showWarningMessage(text('ui.overview.na.pull-request-failed'));
      return;
    }
    const pulls = result.evidence.pulls.filter((pull) => isOpenableUrl(pull.url));
    if (pulls.length === 0) {
      void vscode.window.showInformationMessage(text('ui.overview.na.no-pull-request'));
      return;
    }
    const pull =
      pulls.length === 1
        ? pulls[0]
        : (
            await vscode.window.showQuickPick(
              pulls.map((p) => ({ label: `#${p.number} ${p.title}`, description: `${p.state}, ${p.link}`, pull: p })),
              { placeHolder: text('ui.overview.pick-pull-request') },
            )
          )?.pull;
    if (pull) await vscode.env.openExternal(vscode.Uri.parse(pull.url));
  }

  private async load(interactive: boolean): Promise<void> {
    const request = ++this.request;
    this.registry = await readRegistry();
    if (this.registry.kind !== 'ok') {
      this.read = undefined;
      return this.render();
    }

    this.phase = 'loading';
    this.render();
    const token = await getGitHubToken(interactive, ['repo', 'project']);
    if (request !== this.request) return;
    if (!token) {
      this.phase = 'sign-in';
      return this.render();
    }

    const { registry } = this.registry;
    const result = await readProject(token, registry.project, registry.repositories.map((r) => r.repository));
    if (request !== this.request) return;
    if (result.ok) {
      const pulls = await Promise.all(registry.repositories.map((r) => readMergedPulls(token, r.repository)));
      if (request !== this.request) return;
      this.pulls = pulls.flatMap((r) => (r.ok ? r.pulls : []));
      this.skippedChecks = pulls.flatMap((r) => (r.ok ? [] : [r.error]));
      this.read = result.read;
      this.phase = 'ready';
    } else {
      this.error = result.error;
      this.phase = 'error';
    }
    this.render();
  }

  private state(): OverviewState {
    if (this.registry.kind === 'none') return { kind: 'no-registry' };
    if (this.registry.kind === 'invalid') return { kind: 'registry-invalid', issues: this.registry.issues };
    if (this.phase === 'sign-in') return { kind: 'sign-in' };
    if (this.phase === 'loading') return { kind: 'loading' };
    if (this.phase === 'error' && this.error) return { kind: 'error', error: this.error };
    if (!this.read) return { kind: 'loading' };

    const links = requirementsByIssue(this.loaded?.artifacts ?? []);
    const cards: OverviewCard[] = this.read.cards.map((card) => ({
      ...card,
      requirement: links.get(normalizeIssueUrl(card.url)),
    }));
    return {
      kind: 'ready',
      projectTitle: this.read.title,
      lanes: buildLanes(this.registry.registry, cards),
      skipped: this.read.skipped,
      hidden: [...this.hidden],
      collapsed: [...this.collapsed],
      mismatches: findMismatches({
        artifacts: this.loaded?.artifacts ?? [],
        cards: this.read.cards,
        repositories: this.registry.registry.repositories.map((r) => r.repository),
        pulls: this.pulls,
      }),
      skippedChecks: this.skippedChecks,
    };
  }

  private render(): void {
    if (!this.panel) return;
    const nonce = randomBytes(16).toString('hex');
    this.panel.title = 'Weaver';
    this.panel.webview.html = renderOverviewHtml(this.state(), nonce, this.panel.webview.cspSource, currentLocale());
  }
}
