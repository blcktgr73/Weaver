import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  applyLaneOrder,
  buildLanes,
  cloneDirectories,
  FabricRegistry,
  FocusTarget,
  focusCards,
  findMismatches,
  makeSnapshot,
  MergedPull,
  moveLane,
  readSnapshot,
  snapshotAge,
  normalizeIssueUrl,
  offlineCards,
  Notice,
  parseFabric,
  RequirementLink,
  requirementsByIssue,
  honoredException,
  staleNotices,
  ValidationIssue,
} from '@palab/weaver-markdown';
import { placeWithRules, ProjectCard, ProjectRead, readMergedPulls, readProject } from '@palab/weaver-github';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fabricRoot } from './fabricRoot';
import { fetchEvidence, getGitHubToken } from './github';
import { currentLocale, message as text } from './locale';
import { OverviewCard, OverviewState, renderOverviewHtml } from './overviewHtml';
import { processStore } from './processStore';
import { isOpenableUrl } from './requirementHtml';
import { REQUIREMENT_EDITOR } from './requirementEditor';
import type { RequirementView } from './requirementView';
import { Loaded } from './workspace';

const REGISTRY_FILE = 'fabric.yaml';
const HIDDEN_KEY = 'weaver.overview.hiddenProjects';
const COLLAPSED_KEY = 'weaver.overview.collapsedProjects';
const ORDER_KEY = 'weaver.overview.laneOrder';
const SNAPSHOT_KEY = 'weaver.overview.lastRead';

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
  /** When `read` was read from GitHub, as an ISO date (DEC-011). */
  private readAt: string | undefined;
  private phase: 'sign-in' | 'loading' | 'error' | 'ready' = 'loading';
  private error: Notice | undefined;
  /** Newest request wins, so a slow answer cannot overwrite a newer one. */
  private request = 0;
  /** Set by Show on the Overview; the matching cards are highlighted until it is cleared. */
  private focus: FocusTarget | undefined;
  /** Recently merged pull requests, and the checks that could not read them. */
  private pulls: MergedPull[] = [];
  private skippedChecks: Notice[] = [];
  /** Which projects are shown and which lanes are folded. Stored on this computer, never in the repository. */
  private hidden: Set<string>;
  private collapsed: Set<string>;
  /** The lane order the user chose, on this computer only. Lanes not in it keep the registry order. */
  private order: string[];

  constructor(
    private readonly store: vscode.Memento,
    private readonly requirements: RequirementView,
  ) {
    this.hidden = new Set(store.get<string[]>(HIDDEN_KEY, []));
    this.collapsed = new Set(store.get<string[]>(COLLAPSED_KEY, []));
    this.order = store.get<string[]>(ORDER_KEY, []);
  }

  /** The registered repositories in the order the user chose, then the registry order. */
  private repositories(): string[] {
    if (this.registry.kind !== 'ok') return [];
    return applyLaneOrder(this.registry.registry.repositories, this.order).map((r) => r.repository);
  }

  private move(repository: string, delta: -1 | 1): void {
    const full = this.repositories();
    const shown = full.filter((name) => !this.hidden.has(name));
    this.order = moveLane(full, shown, repository, delta);
    void this.store.update(ORDER_KEY, this.order);
    this.render();
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
      this.panel.webview.onDidReceiveMessage((message: { type: string; url?: string; id?: string; path?: string; delta?: number }) => this.onMessage(message));
    }
    await this.load(false);
  }

  /** Opens the Overview and highlights the cards of a requirement, or of one task (TASK-041). */
  async showFocused(loaded: Loaded, target: FocusTarget): Promise<void> {
    this.focus = target;
    await this.show(loaded);
    if (this.phase !== 'ready' || !this.read) return;
    const label = target.taskId ?? target.requirementId;
    if (this.matching().length === 0) void vscode.window.showInformationMessage(text('ui.overview.focus-none', { target: label }));
  }

  /** The cards that the current focus names. */
  private matching(): ProjectCard[] {
    if (!this.focus || !this.read) return [];
    return focusCards(this.read.cards, requirementsByIssue(this.loaded?.artifacts ?? []), this.focus);
  }

  /** Turns on the project of each highlighted card and unfolds its lane, so the card can be seen. */
  private revealFocus(): void {
    if (this.registry.kind !== 'ok') return;
    for (const card of this.matching()) {
      const lane = this.registry.registry.repositories.find((r) => r.repository.toLowerCase() === card.repository.toLowerCase());
      if (!lane) continue;
      this.hidden.delete(lane.repository);
      this.collapsed.delete(lane.repository);
    }
    void this.store.update(HIDDEN_KEY, [...this.hidden]);
    void this.store.update(COLLAPSED_KEY, [...this.collapsed]);
  }

  /** The workspace was re-read: requirement links may have changed. */
  update(loaded: Loaded): void {
    this.loaded = loaded;
    if (this.panel) this.render();
  }

  private async onMessage(message: { type: string; url?: string; id?: string; path?: string; delta?: number }): Promise<void> {
    if (message.type === 'signIn') await this.load(true);
    else if (message.type === 'refresh') await this.load(false);
    else if (message.type === 'toggleLane' && message.id) this.flip(this.hidden, HIDDEN_KEY, message.id);
    else if (message.type === 'foldLane' && message.id) this.flip(this.collapsed, COLLAPSED_KEY, message.id);
    else if (message.type === 'showAll') {
      this.hidden.clear();
      void this.store.update(HIDDEN_KEY, []);
      this.render();
    }
    else if (message.type === 'clearFocus') {
      this.focus = undefined;
      this.render();
    } else if (message.type === 'moveLane' && message.id && (message.delta === -1 || message.delta === 1)) {
      this.move(message.id, message.delta);
    } else if (message.type === 'cloneMissing') await vscode.commands.executeCommand('weaver.cloneRegistered');
    else if (message.type === 'openCard' && message.url) await this.openCard(message.url);
    else if (message.type === 'openFile' && message.path) {
      const uri = this.loaded?.uris.get(message.path);
      if (uri) await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Active });
    }
    else if (message.type === 'cardMenu' && message.url) await this.cardMenu(message.url);
    else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
      await vscode.env.openExternal(vscode.Uri.parse(message.url));
    } else if (message.type === 'openRequirement' && message.id) {
      const requirement = this.loaded?.artifacts.find((a) => a.kind === 'requirement' && a.id === message.id);
      const uri = requirement && this.loaded?.uris.get(requirement.path);
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, REQUIREMENT_EDITOR, vscode.ViewColumn.Active);
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
    // A card built from the files has no Issue address; it is named by its requirement and task.
    const named = /^task:([^/]+)\/(.+)$/.exec(url);
    if (named) {
      const requirement = this.loaded?.artifacts.find((a) => a.kind === 'requirement' && a.id === named[1]);
      if (requirement?.kind === 'requirement' && this.loaded) this.requirements.show(this.loaded, requirement, named[2]);
      return;
    }
    const found = this.find(url);
    if (!found) {
      // The board was built from files: the Issue address still names the requirement.
      const link = requirementsByIssue(this.loaded?.artifacts ?? []).get(normalizeIssueUrl(url));
      const requirement = link && this.loaded?.artifacts.find((a) => a.kind === 'requirement' && a.id === link.id);
      if (link && requirement?.kind === 'requirement' && this.loaded) this.requirements.show(this.loaded, requirement, link.taskId);
      else if (isOpenableUrl(url)) await vscode.env.openExternal(vscode.Uri.parse(url));
      return;
    }
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

    // A clone under the fabric root counts as the repository folder, even when it is not open here.
    const root = fabricRoot();
    let clone: vscode.Uri | undefined;
    if (!folder && root && this.registry.kind === 'ok') {
      const directory = cloneDirectories(this.registry.registry.repositories.map((r) => r.repository)).get(card.repository);
      const candidate = directory ? path.join(root, directory) : undefined;
      if (candidate && (await fs.stat(candidate).then((s) => s.isDirectory(), () => false))) clone = vscode.Uri.file(candidate);
    }

    const items: Item[] = [
      taskUri
        ? { label: `$(file) ${taskLabel}`, detail: link?.taskPath, run: () => vscode.window.showTextDocument(taskUri, { viewColumn: vscode.ViewColumn.Active }) }
        : unavailable(taskLabel, link ? text('ui.overview.na.no-task-file', { task }) : text('ui.overview.na.no-requirement')),
      link && requirementUri
        ? {
            label: `$(markdown) ${text('ui.overview.menu.requirement-source', { id: link.id })}`,
            detail: link.path,
            run: () => vscode.commands.executeCommand('vscode.openWith', requirementUri, 'default', vscode.ViewColumn.Active),
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
        : clone
          ? { label: `$(folder-opened) ${text('ui.overview.menu.repository-folder', { repository: card.repository })}`, detail: clone.fsPath, run: () => vscode.commands.executeCommand('vscode.openFolder', clone, { forceNewWindow: true }) }
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
    const repositories = registry.repositories.map((r) => r.repository);
    // A repository never asked has no process to draw from, so the first picture waits for it (DEC-015);
    // otherwise the last answer is used now and checked for a change once the board is shown.
    const known = repositories.every((name) => processStore.has(name));
    const [result] = await Promise.all([readProject(token, registry.project, repositories), known ? undefined : processStore.refresh(token, repositories)]);
    if (request !== this.request) return;
    if (result.ok) {
      const pulls = await Promise.all(registry.repositories.map((r) => readMergedPulls(token, r.repository)));
      if (request !== this.request) return;
      this.pulls = pulls.flatMap((r) => (r.ok ? r.pulls : []));
      this.skippedChecks = pulls.flatMap((r) => (r.ok ? [] : [r.error]));
      this.read = result.read;
      this.readAt = new Date().toISOString();
      void this.store.update(SNAPSHOT_KEY, makeSnapshot(registry.project, result.read.title, result.read.cards, new Date(this.readAt)));
      this.revealFocus();
      this.phase = 'ready';
    } else {
      this.error = result.error;
      this.phase = 'error';
      if (!this.read) {
        const kept = readSnapshot<ProjectCard>(this.store.get(SNAPSHOT_KEY), registry.project);
        if (kept) {
          this.read = { title: kept.title, cards: kept.cards, skipped: 0 };
          this.readAt = kept.readAt;
        }
      }
    }
    this.render();

    if (known && result.ok) {
      void processStore.refresh(token, repositories).then((changed) => {
        if (changed && request === this.request) this.render();
      });
    }
  }

  /** The cards placed with the rules of each repository's process, which may have changed since they were read. */
  private placed(cards: readonly ProjectCard[]): ProjectCard[] {
    return placeWithRules(cards, processStore.rulesFor);
  }

  private state(): OverviewState {
    if (this.registry.kind === 'none') return { kind: 'no-registry' };
    if (this.registry.kind === 'invalid') return { kind: 'registry-invalid', issues: this.registry.issues };
    if (this.phase === 'sign-in') return { kind: 'sign-in' };
    if (this.phase === 'loading') return { kind: 'loading' };
    if (this.phase === 'error' && this.error) {
      // GitHub could not be read: show the last board read (DEC-011), or else the board the files give.
      if (this.read && this.readAt) {
        const links = requirementsByIssue(this.loaded?.artifacts ?? []);
        const cards: OverviewCard[] = this.placed(this.read.cards).map((card) => ({ ...card, requirement: links.get(normalizeIssueUrl(card.url)), stale: [] }));
        const lanes = applyLaneOrder(buildLanes(this.registry.registry, cards), this.order);
        return { kind: 'error', error: this.error, offline: { lanes, collapsed: [...this.collapsed], snapshotAge: snapshotAge(this.readAt, new Date()) } };
      }
      const lanes = buildLanes(
        this.registry.registry,
        offlineCards(this.loaded?.artifacts ?? [], this.registry.registry).map(
          (c): OverviewCard => ({
            repository: c.repository,
            number: c.issueNumber ?? 0,
            title: c.title,
            url: c.issueUrl ?? '',
            assignees: [],
            taskId: c.taskId,
            placement: { column: c.column, gaps: c.statusUnknown ? [{ code: 'gap.offline-no-status' }] : [] },
            requirement: c.requirement,
            stale: [],
            fromFiles: true,
          }),
        ),
      );
      return { kind: 'error', error: this.error, offline: { lanes: applyLaneOrder(lanes, this.order), collapsed: [...this.collapsed] } };
    }
    if (!this.read) return { kind: 'loading' };

    const links = requirementsByIssue(this.loaded?.artifacts ?? []);
    const now = new Date();
    const focused = new Set(this.matching().map((card) => normalizeIssueUrl(card.url)));
    // A repository's process sets its own idle days; the user's setting is for the rest.
    const idleSetting = vscode.workspace.getConfiguration('weaver').get<number>('staleDays', 14);
    const placedCards = this.placed(this.read.cards);
    const tasks = new Map(
      (this.loaded?.artifacts ?? []).flatMap((a) => (a.kind === 'task' ? [[a.path, a] as const] : [])),
    );
    const cards: OverviewCard[] = placedCards.map((card) => {
      const requirement = links.get(normalizeIssueUrl(card.url));
      const task = requirement?.taskPath ? tasks.get(requirement.taskPath) : undefined;
      return {
        ...card,
        requirement,
        focus: focused.has(normalizeIssueUrl(card.url)),
        stale: staleNotices(
          {
            column: card.placement.column,
            state: card.state,
            updatedAt: card.updatedAt,
            pullCount: card.pullCount,
            needsDecision: task?.status === 'needs-human-decision',
            evidenceException: Boolean(honoredException(task?.evidenceException, processStore.evidenceFor(card.repository))),
            pullRequest: processStore.evidenceFor(card.repository)?.pullRequest,
          },
          now,
          processStore.staleDaysFor(card.repository) ?? idleSetting,
        ),
      };
    });
    return {
      kind: 'ready',
      projectTitle: this.read.title,
      lanes: applyLaneOrder(buildLanes(this.registry.registry, cards), this.order),
      skipped: this.read.skipped,
      hidden: [...this.hidden],
      collapsed: [...this.collapsed],
      mismatches: findMismatches({
        artifacts: this.loaded?.artifacts ?? [],
        cards: placedCards,
        repositories: this.registry.registry.repositories.map((r) => r.repository),
        pulls: this.pulls,
        exceptionsIgnored: this.registry.registry.repositories.map((r) => r.repository).filter((name) => processStore.evidenceFor(name)?.exceptions === false),
        closingNotRequired: this.registry.registry.repositories.map((r) => r.repository).filter((name) => processStore.evidenceFor(name)?.closingPullRequest === false),
        boardSourced: this.registry.registry.repositories.map((r) => r.repository).filter((name) => processStore.rulesFor(name)?.source === 'board-status'),
      }),
      skippedChecks: this.skippedChecks,
      focusActive: focused.size > 0,
    };
  }

  private render(): void {
    if (!this.panel) return;
    const nonce = randomBytes(16).toString('hex');
    this.panel.title = 'Weaver';
    this.panel.webview.html = renderOverviewHtml(this.state(), nonce, this.panel.webview.cspSource, currentLocale());
  }
}
