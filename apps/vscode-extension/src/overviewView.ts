import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  buildLanes,
  FabricRegistry,
  normalizeIssueUrl,
  Notice,
  parseFabric,
  requirementsByIssue,
  ValidationIssue,
} from '@palab/weaver-markdown';
import { ProjectRead, readProject } from '@palab/weaver-github';
import { getGitHubToken } from './github';
import { currentLocale } from './locale';
import { OverviewCard, OverviewState, renderOverviewHtml } from './overviewHtml';
import { isOpenableUrl } from './requirementHtml';
import { REQUIREMENT_EDITOR } from './requirementEditor';
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
  /** Which projects are shown and which lanes are folded. Stored on this computer, never in the repository. */
  private hidden: Set<string>;
  private collapsed: Set<string>;

  constructor(private readonly store: vscode.Memento) {
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
      this.panel.webview.onDidReceiveMessage((message: { type: string; url?: string; id?: string }) => this.onMessage(message));
    }
    await this.load(false);
  }

  /** The workspace was re-read: requirement links may have changed. */
  update(loaded: Loaded): void {
    this.loaded = loaded;
    if (this.panel) this.render();
  }

  private async onMessage(message: { type: string; url?: string; id?: string }): Promise<void> {
    if (message.type === 'signIn') await this.load(true);
    else if (message.type === 'refresh') await this.load(false);
    else if (message.type === 'toggleLane' && message.id) this.flip(this.hidden, HIDDEN_KEY, message.id);
    else if (message.type === 'foldLane' && message.id) this.flip(this.collapsed, COLLAPSED_KEY, message.id);
    else if (message.type === 'showAll') {
      this.hidden.clear();
      void this.store.update(HIDDEN_KEY, []);
      this.render();
    }
    else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
      await vscode.env.openExternal(vscode.Uri.parse(message.url));
    } else if (message.type === 'openRequirement' && message.id) {
      const requirement = this.loaded?.artifacts.find((a) => a.kind === 'requirement' && a.id === message.id);
      const uri = requirement && this.loaded?.uris.get(requirement.path);
      if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, REQUIREMENT_EDITOR, vscode.ViewColumn.Beside);
    }
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
    };
  }

  private render(): void {
    if (!this.panel) return;
    const nonce = randomBytes(16).toString('hex');
    this.panel.title = 'Weaver';
    this.panel.webview.html = renderOverviewHtml(this.state(), nonce, this.panel.webview.cspSource, currentLocale());
  }
}
