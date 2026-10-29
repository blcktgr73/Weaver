import * as vscode from 'vscode';
import { RequirementView } from './requirementView';
import { Loaded, loadWorkspaceArtifacts, publishDiagnostics, requirementsOf } from './workspace';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('weaver');
  const view = new RequirementView();

  const refresh = async (): Promise<Loaded> => {
    const loaded = await loadWorkspaceArtifacts();
    publishDiagnostics(diagnostics, loaded);
    view.update(loaded);
    return loaded;
  };

  const pickRequirement = async (loaded: Loaded) => {
    const requirements = requirementsOf(loaded);
    if (requirements.length === 0) {
      void vscode.window.showInformationMessage('Weaver: no valid requirement artifacts found. Check the Problems panel.');
      return undefined;
    }
    const selected = await vscode.window.showQuickPick(
      requirements.map((requirement) => ({
        label: `${requirement.id}  ${requirement.title}`,
        description: requirement.status,
        detail: requirement.path,
        requirement,
      })),
      { placeHolder: 'Select a Weaver requirement' },
    );
    return selected?.requirement;
  };

  const openSource = vscode.commands.registerCommand('weaver.openRequirementSource', async () => {
    const loaded = await refresh();
    const requirement = await pickRequirement(loaded);
    const uri = requirement && loaded.uris.get(requirement.path);
    if (uri) await vscode.window.showTextDocument(uri);
  });

  // From the editor title button the file is known; from the command palette the user picks one.
  const openView = vscode.commands.registerCommand('weaver.openRequirementView', async (resource?: vscode.Uri) => {
    const loaded = await refresh();
    if (resource instanceof vscode.Uri) {
      const requirement = requirementsOf(loaded).find((r) => loaded.uris.get(r.path)?.toString() === resource.toString());
      if (requirement) {
        view.show(loaded, requirement);
      } else {
        void vscode.window.showInformationMessage('Weaver: this file is not a valid requirement. Check the Problems panel.');
      }
      return;
    }
    const requirement = await pickRequirement(loaded);
    if (requirement) view.show(loaded, requirement);
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

  context.subscriptions.push(diagnostics, openSource, openView, scanWorkspace, onSave);
  void refresh();
}

export function deactivate(): void {
  // Diagnostics are disposed through context.subscriptions.
}
