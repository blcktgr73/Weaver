import * as vscode from 'vscode';
import { currentLocale, message } from './locale';
import { REQUIREMENT_EDITOR, RequirementEditorProvider } from './requirementEditor';
import { RequirementView } from './requirementView';
import { Loaded, loadWorkspaceArtifacts, publishDiagnostics, requirementsOf } from './workspace';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('weaver');
  const view = new RequirementView();

  const refresh = async (): Promise<Loaded> => {
    const loaded = await loadWorkspaceArtifacts();
    publishDiagnostics(diagnostics, loaded, currentLocale());
    view.update(loaded);
    return loaded;
  };

  const pickRequirement = async (loaded: Loaded) => {
    const requirements = requirementsOf(loaded);
    if (requirements.length === 0) {
      void vscode.window.showInformationMessage(message('ui.msg.no-requirements'));
      return undefined;
    }
    const selected = await vscode.window.showQuickPick(
      requirements.map((requirement) => ({
        label: `${requirement.id}  ${requirement.title}`,
        description: requirement.status,
        detail: requirement.path,
        requirement,
      })),
      { placeHolder: message('ui.msg.pick-requirement') },
    );
    return selected?.requirement;
  };

  const openSource = vscode.commands.registerCommand('weaver.openRequirementSource', async () => {
    const loaded = await refresh();
    const requirement = await pickRequirement(loaded);
    const uri = requirement && loaded.uris.get(requirement.path);
    if (uri) await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
  });

  // From the editor title button the file is known; from the command palette the user picks one.
  const openView = vscode.commands.registerCommand('weaver.openRequirementView', async (resource?: vscode.Uri) => {
    const loaded = await refresh();
    if (resource instanceof vscode.Uri) {
      const requirement = requirementsOf(loaded).find((r) => loaded.uris.get(r.path)?.toString() === resource.toString());
      if (requirement) {
        // The file itself is known, so show its view in place of the source.
        await vscode.commands.executeCommand('vscode.openWith', resource, REQUIREMENT_EDITOR);
      } else {
        void vscode.window.showInformationMessage(message('ui.msg.not-requirement'));
      }
      return;
    }
    const requirement = await pickRequirement(loaded);
    if (requirement) view.show(loaded, requirement);
  });

  const scanWorkspace = vscode.commands.registerCommand('weaver.scanWorkspace', async () => {
    const loaded = await refresh();
    const { errors, warnings } = publishDiagnostics(diagnostics, loaded, currentLocale());
    const requirements = requirementsOf(loaded).length;
    const tasks = loaded.artifacts.length - requirements;
    const summary = message('ui.msg.scan-summary', {
      requirements,
      tasks,
      files: loaded.markdownFileCount,
      errors,
      warnings,
    });

    if (errors > 0) {
      const showProblems = message('ui.msg.show-problems');
      const choice = await vscode.window.showWarningMessage(summary, showProblems);
      if (choice) await vscode.commands.executeCommand('workbench.actions.view.problems');
    } else {
      void vscode.window.showInformationMessage(summary);
    }
  });

  const editor = vscode.window.registerCustomEditorProvider(
    REQUIREMENT_EDITOR,
    new RequirementEditorProvider(view, refresh),
    { supportsMultipleEditorsPerDocument: true, webviewOptions: { retainContextWhenHidden: false } },
  );

  const onSave = vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId === 'markdown') void refresh();
  });

  const onLanguage = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('weaver.language')) void refresh();
  });

  context.subscriptions.push(diagnostics, editor, openSource, openView, scanWorkspace, onSave, onLanguage);
  void refresh();
}

export function deactivate(): void {
  // Diagnostics are disposed through context.subscriptions.
}
