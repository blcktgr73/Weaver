import * as vscode from 'vscode';
import { documentKindOf, viewTargetOf } from '@palab/weaver-markdown';
import { currentLocale, message } from './locale';
import { REQUIREMENT_EDITOR, RequirementEditorProvider } from './requirementEditor';
import { OverviewView, readRegistry } from './overviewView';
import { RequirementView } from './requirementView';
import { Loaded, loadWorkspaceArtifacts, publishDiagnostics, requirementsOf } from './workspace';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('weaver');
  const view = new RequirementView();
  const overview = new OverviewView(context.globalState, view);

  // Tells the menus whether the active file is a Weaver document (TASK-018).
  let latest: Loaded | undefined;
  const publishDocumentKind = (): void => {
    const document = vscode.window.activeTextEditor?.document;
    const kind =
      document && latest
        ? documentKindOf(latest.artifacts, vscode.workspace.asRelativePath(document.uri, false))
        : 'none';
    void vscode.commands.executeCommand('setContext', 'weaver.documentKind', kind);
  };

  const refresh = async (): Promise<Loaded> => {
    const loaded = await loadWorkspaceArtifacts();
    latest = loaded;
    publishDocumentKind();
    publishDiagnostics(diagnostics, loaded, currentLocale());
    view.update(loaded);
    overview.update(loaded);
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
      const target = viewTargetOf(loaded.artifacts, vscode.workspace.asRelativePath(resource, false));
      if (!target) {
        void vscode.window.showInformationMessage(message('ui.msg.not-requirement'));
      } else if (target.taskId) {
        // A task file: show its requirement, scrolled to the task.
        view.show(loaded, target.requirement, target.taskId);
      } else {
        // The requirement file itself: show its view in place of the source.
        await vscode.commands.executeCommand('vscode.openWith', resource, REQUIREMENT_EDITOR);
      }
      return;
    }
    const requirement = await pickRequirement(loaded);
    if (requirement) view.show(loaded, requirement);
  });

  const openOverview = vscode.commands.registerCommand('weaver.openOverview', async () => {
    await overview.show(await refresh());
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

  const onActiveEditor = vscode.window.onDidChangeActiveTextEditor(publishDocumentKind);

  const onLanguage = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('weaver.language')) void refresh();
  });

  context.subscriptions.push(diagnostics, editor, openSource, openView, openOverview, scanWorkspace, onSave, onActiveEditor, onLanguage);
  void refresh().then(async (loaded) => {
    // With a registry at the workspace root, the Overview is where exploration starts (REQ-006).
    if ((await readRegistry()).kind !== 'none') await overview.show(loaded);
  });
}

export function deactivate(): void {
  // Diagnostics are disposed through context.subscriptions.
}
