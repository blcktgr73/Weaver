import * as vscode from 'vscode';
import {
  Artifact,
  loadWorkspace,
  parseProcess,
  rosterGaps,
  Locale,
  t,
  ValidationIssue,
  validationKey,
  WorkspaceResult,
} from '@palab/weaver-markdown';
import { readUserConfig } from './userConfig';

const EXCLUDE = '**/{node_modules,.git,dist,out}/**';
const MAX_FILES = 2000;
/** A repository's process file (DEC-015). A workspace may hold the folders of a few repositories. */
const PROCESS_FILE_GLOB = '**/.weaver/process.yaml';
const MAX_PROCESS_FILES = 20;

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
  const loaded = loadWorkspace(files);

  // The process files of the repositories in the workspace are checked too, so that a mistake
  // shows in the Problems panel. A wrong section keeps its defaults; nothing else changes here.
  const processFiles = await vscode.workspace.findFiles(PROCESS_FILE_GLOB, EXCLUDE, MAX_PROCESS_FILES);
  for (const uri of processFiles) {
    const path = vscode.workspace.asRelativePath(uri, false);
    uris.set(path, uri);
    loaded.issues.push(...parseProcess(path, decoder.decode(await vscode.workspace.fs.readFile(uri))).issues);
  }

  // Who works on, reviews, and approves a task is judged against the roster of the personal configuration
  // (DEC-013, DEC-014). With no roster there is nothing to judge against, so no problem is raised.
  const user = await readUserConfig();
  if (user.kind === 'ok' && user.config.roster) {
    for (const artifact of loaded.artifacts) {
      if (artifact.kind !== 'task') continue;
      for (const gap of rosterGaps(artifact, undefined, user.config.roster)) {
        loaded.issues.push({ severity: 'warning', code: gap.code.replace(/^gap\./, ''), ...(gap.args ? { args: gap.args } : {}), path: artifact.path });
      }
    }
  }
  return { ...loaded, uris, markdownFileCount: files.length };
}

export function publishDiagnostics(
  collection: vscode.DiagnosticCollection,
  loaded: Loaded,
  locale: Locale,
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
          t(validationKey(issue.code), locale, issue.args),
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
