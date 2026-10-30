import * as vscode from 'vscode';
import { message } from './locale';
import { escapeHtml } from './requirementHtml';
import { RequirementView } from './requirementView';
import { Loaded, requirementsOf } from './workspace';

export const REQUIREMENT_EDITOR = 'weaver.requirementEditor';

/** Opens a requirement file as its Weaver view instead of raw Markdown (TASK-017). */
export class RequirementEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(
    private readonly view: RequirementView,
    private readonly load: () => Promise<Loaded>,
  ) {}

  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = { enableScripts: true };
    const loaded = await this.load();
    const path = vscode.workspace.asRelativePath(document.uri, false);
    const requirement = requirementsOf(loaded).find((r) => r.path === path);
    if (!requirement) {
      panel.webview.html = `<body style="padding:24px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">${escapeHtml(message('ui.msg.not-requirement'))}</body>`;
      return;
    }
    this.view.attach(panel, loaded, requirement);
  }
}
