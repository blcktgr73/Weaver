import * as vscode from 'vscode';
import { Loaded, loadWorkspaceArtifacts, publishDiagnostics, requirementsOf } from './workspace';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('weaver');

  const refresh = async (): Promise<Loaded> => {
    const loaded = await loadWorkspaceArtifacts();
    publishDiagnostics(diagnostics, loaded);
    return loaded;
  };

  const openRequirement = vscode.commands.registerCommand('weaver.openRequirement', async () => {
    const loaded = await refresh();
    const requirements = requirementsOf(loaded);

    if (requirements.length === 0) {
      void vscode.window.showInformationMessage('Weaver: no requirement artifacts found in this workspace.');
      return;
    }

    const selected = await vscode.window.showQuickPick(
      requirements.map((requirement) => ({
        label: `${requirement.id}  ${requirement.title}`,
        description: requirement.status,
        detail: requirement.path,
        uri: loaded.uris.get(requirement.path),
      })),
      { placeHolder: 'Select a Weaver requirement' },
    );

    if (selected?.uri) {
      await vscode.window.showTextDocument(selected.uri);
    }
  });

  const scanWorkspace = vscode.commands.registerCommand('weaver.scanWorkspace', async () => {
    const loaded = await refresh();
    const { errors, warnings } = publishDiagnostics(diagnostics, loaded);
    const requirements = requirementsOf(loaded).length;
    const tasks = loaded.artifacts.length - requirements;
    const summary =
      `Weaver scan: ${requirements} requirement(s), ${tasks} task file(s), ` +
      `${loaded.markdownFileCount} Markdown file(s); ${errors} error(s), ${warnings} warning(s).`;

    if (errors > 0) {
      const choice = await vscode.window.showWarningMessage(summary, 'Show Problems');
      if (choice) await vscode.commands.executeCommand('workbench.actions.view.problems');
    } else {
      void vscode.window.showInformationMessage(summary);
    }
  });

  const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId === 'markdown') void refresh();
  });

  context.subscriptions.push(diagnostics, openRequirement, scanWorkspace, onSave);
  void refresh();
}

export function deactivate(): void {
  // Diagnostics are disposed through context.subscriptions.
}
