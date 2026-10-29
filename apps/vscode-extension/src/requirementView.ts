import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { RequirementArtifact } from '@palab/weaver-markdown';
import { isOpenableUrl, renderRequirementHtml } from './requirementHtml';
import { Loaded } from './workspace';

interface Panel {
  panel: vscode.WebviewPanel;
  path: string;
  uri: vscode.Uri | undefined;
}

/** Read-only view of one requirement. One panel per requirement ID. */
export class RequirementView {
  private readonly panels = new Map<string, Panel>();

  show(loaded: Loaded, requirement: RequirementArtifact): void {
    const existing = this.panels.get(requirement.id);
    if (existing) {
      existing.panel.reveal(undefined, true);
      this.render(existing, loaded, requirement);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'weaver.requirement',
      requirement.id,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: false },
    );
    const entry: Panel = { panel, path: requirement.path, uri: loaded.uris.get(requirement.path) };
    this.panels.set(requirement.id, entry);

    panel.onDidDispose(() => this.panels.delete(requirement.id));
    panel.webview.onDidReceiveMessage(async (message: { type: string; url?: string }) => {
      if (message.type === 'openSource' && entry.uri) {
        await vscode.window.showTextDocument(entry.uri, { viewColumn: vscode.ViewColumn.One });
      } else if (message.type === 'openPreview' && entry.uri) {
        await vscode.commands.executeCommand('markdown.showPreviewToSide', entry.uri);
      } else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
    });
    this.render(entry, loaded, requirement);
  }

  /** Re-render open panels after the workspace was re-read. */
  update(loaded: Loaded): void {
    for (const [id, entry] of this.panels) {
      const requirement = loaded.artifacts.find((a) => a.kind === 'requirement' && a.id === id);
      if (requirement?.kind === 'requirement') {
        entry.path = requirement.path;
        entry.uri = loaded.uris.get(requirement.path);
        this.render(entry, loaded, requirement);
      } else {
        entry.panel.webview.html = `<body style="padding:24px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">${id} is no longer a valid requirement. Check the Problems panel.</body>`;
      }
    }
  }

  private render(entry: Panel, loaded: Loaded, requirement: RequirementArtifact): void {
    const { panel } = entry;
    const nonce = randomBytes(16).toString('hex');
    const issues = loaded.issues.filter((issue) => issue.path === requirement.path);
    panel.title = `${requirement.id} ${requirement.title}`;
    panel.webview.html = renderRequirementHtml(requirement, issues, nonce, panel.webview.cspSource);
  }
}
