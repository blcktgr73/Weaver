import * as vscode from 'vscode';
import { Artifact, loadWorkspace, ValidationIssue, WorkspaceResult } from '@palab/weaver-markdown';

const EXCLUDE = '**/{node_modules,.git,dist,out}/**';
const MAX_FILES = 2000;

export interface Loaded extends WorkspaceResult {
  uris: Map<string, vscode.Uri>;
  markdownFileCount: number;
}

/** Reads every Markdown file in the workspace and validates the Weaver artifacts among them. */
export async function loadWorkspaceArtifacts(): Promise<Loaded> {
  const found = await vscode.workspace.findFiles('**/*.md', EXCLUDE, MAX_FILES);
  const decoder = new TextDecoder('utf-8');
  const uris = new Map<string, vscode.Uri>();
  const files = await Promise.all(
    found.map(async (uri) => {
      const path = vscode.workspace.asRelativePath(uri, false);
      uris.set(path, uri);
      const bytes = await vscode.workspace.fs.readFile(uri);
      return { path, text: decoder.decode(bytes) };
    }),
  );
  return { ...loadWorkspace(files), uris, markdownFileCount: files.length };
}

export function publishDiagnostics(
  collection: vscode.DiagnosticCollection,
  loaded: Loaded,
): { errors: number; warnings: number } {
  collection.clear();
  const byPath = new Map<string, ValidationIssue[]>();
  for (const issue of loaded.issues) {
    byPath.set(issue.path, [...(byPath.get(issue.path) ?? []), issue]);
  }

  let errors = 0;
  let warnings = 0;
  for (const [path, issues] of byPath) {
    const uri = loaded.uris.get(path);
    if (!uri) continue;
    collection.set(
      uri,
      issues.map((issue) => {
        const isError = issue.severity === 'error';
        if (isError) errors += 1;
        else warnings += 1;
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          issue.message,
          isError ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = 'Weaver';
        diagnostic.code = issue.code;
        return diagnostic;
      }),
    );
  }
  return { errors, warnings };
}

export function requirementsOf(loaded: Loaded): Extract<Artifact, { kind: 'requirement' }>[] {
  return loaded.artifacts.filter((a): a is Extract<Artifact, { kind: 'requirement' }> => a.kind === 'requirement');
}
