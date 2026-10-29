import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { RequirementArtifact } from '@palab/weaver-markdown';
import { fetchIssue, getGitHubToken } from './github';
import { isOpenableUrl, renderRequirementHtml, StatusState } from './requirementHtml';
import { Loaded } from './workspace';

interface Panel {
  panel: vscode.WebviewPanel;
  requirement: RequirementArtifact;
  loaded: Loaded;
  uri: vscode.Uri | undefined;
  status: StatusState;
}

/** Read-only view of one requirement. One panel per requirement ID. */
export class RequirementView {
  private readonly panels = new Map<string, Panel>();

  show(loaded: Loaded, requirement: RequirementArtifact): void {
    const existing = this.panels.get(requirement.id);
    if (existing) {
      existing.panel.reveal(undefined, true);
      this.apply(existing, loaded, requirement);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'weaver.requirement',
      requirement.id,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: false },
    );
    const entry: Panel = {
      panel,
      requirement,
      loaded,
      uri: loaded.uris.get(requirement.path),
      status: { byTask: {}, loading: false },
    };
    this.panels.set(requirement.id, entry);

    panel.onDidDispose(() => this.panels.delete(requirement.id));
    panel.webview.onDidReceiveMessage(async (message: { type: string; url?: string }) => {
      if (message.type === 'openSource' && entry.uri) {
        await vscode.window.showTextDocument(entry.uri, { viewColumn: vscode.ViewColumn.One });
      } else if (message.type === 'openPreview' && entry.uri) {
        await vscode.commands.executeCommand('markdown.showPreviewToSide', entry.uri);
      } else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
      } else if (message.type === 'loadStatus') {
        await this.loadStatus(entry, true);
      }
    });
    this.render(entry);
    // Already signed in? Load without prompting.
    void this.loadStatus(entry, false);
  }

  /** Re-render open panels after the workspace was re-read. */
  update(loaded: Loaded): void {
    for (const [id, entry] of this.panels) {
      const requirement = loaded.artifacts.find((a) => a.kind === 'requirement' && a.id === id);
      if (requirement?.kind === 'requirement') {
        this.apply(entry, loaded, requirement);
      } else {
        entry.panel.webview.html = `<body style="padding:24px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">${id} is no longer a valid requirement. Check the Problems panel.</body>`;
      }
    }
  }

  private apply(entry: Panel, loaded: Loaded, requirement: RequirementArtifact): void {
    entry.requirement = requirement;
    entry.loaded = loaded;
    entry.uri = loaded.uris.get(requirement.path);
    this.render(entry);
  }

  private async loadStatus(entry: Panel, interactive: boolean): Promise<void> {
    if (entry.status.loading) return;
    entry.status = { ...entry.status, loading: true };
    this.render(entry);

    try {
      const token = await getGitHubToken(interactive);
      if (!token) {
        entry.status = { byTask: entry.status.byTask, loading: false };
        return;
      }
      const results = await Promise.all(
        entry.requirement.tasks.map(async (task) => {
          if (!task.issueUrl) return undefined;
          return [task.id, await fetchIssue(token, task.issueUrl)] as const;
        }),
      );
      const byTask: StatusState['byTask'] = {};
      for (const item of results) if (item) byTask[item[0]] = item[1];
      entry.status = { byTask, loading: false };
    } catch (error) {
      entry.status = { byTask: entry.status.byTask, loading: false };
      void vscode.window.showWarningMessage(`Weaver: could not read Issue status (${(error as Error).message}).`);
    } finally {
      if (this.panels.get(entry.requirement.id) === entry) this.render(entry);
    }
  }

  private render(entry: Panel): void {
    const { panel, requirement, loaded } = entry;
    const nonce = randomBytes(16).toString('hex');
    const issues = loaded.issues.filter((issue) => issue.path === requirement.path);
    panel.title = `${requirement.id} ${requirement.title}`;
    panel.webview.html = renderRequirementHtml(requirement, issues, nonce, panel.webview.cspSource, entry.status);
  }
}
