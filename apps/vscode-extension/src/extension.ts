import * as vscode from 'vscode';

type ArtifactKind = 'requirement' | 'task' | 'other';

function artifactKind(contents: string): ArtifactKind {
  const match = contents.match(/^type:\s*(requirement|task)\s*$/m);
  return match?.[1] === 'requirement' || match?.[1] === 'task' ? match[1] : 'other';
}

export function activate(context: vscode.ExtensionContext): void {
  const openRequirement = vscode.commands.registerCommand('weaver.openRequirement', async () => {
    const files = await vscode.workspace.findFiles(
      '**/*.md',
      '**/{node_modules,.git,dist}/**',
      200,
    );
    const requirements: vscode.Uri[] = [];

    for (const file of files) {
      const document = await vscode.workspace.openTextDocument(file);
      if (artifactKind(document.getText()) === 'requirement') {
        requirements.push(file);
      }
    }

    if (requirements.length === 0) {
      void vscode.window.showInformationMessage('Weaver: no requirement artifacts found in this workspace.');
      return;
    }

    const selected = await vscode.window.showQuickPick(
      requirements.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri })),
      { placeHolder: 'Select a Weaver requirement' },
    );

    if (selected) {
      await vscode.window.showTextDocument(selected.uri);
    }
  });

  const scanWorkspace = vscode.commands.registerCommand('weaver.scanWorkspace', async () => {
    const files = await vscode.workspace.findFiles(
      '**/*.md',
      '**/{node_modules,.git,dist}/**',
      500,
    );
    let requirements = 0;
    let tasks = 0;

    for (const file of files) {
      const document = await vscode.workspace.openTextDocument(file);
      const kind = artifactKind(document.getText());
      if (kind === 'requirement') requirements += 1;
      if (kind === 'task') tasks += 1;
    }

    void vscode.window.showInformationMessage(
      `Weaver scan: ${requirements} requirement(s), ${tasks} task(s), ${files.length} Markdown file(s).`,
    );
  });

  context.subscriptions.push(openRequirement, scanWorkspace);
}

export function deactivate(): void {
  // Reserved for future workspace/index cleanup.
}
