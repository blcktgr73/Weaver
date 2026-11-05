import * as vscode from 'vscode';
import {
  Artifact,
  declaredTaskFieldsOf,
  loadWorkspace,
  parseProcess,
  rosterGaps,
  Roster,
  RosterRef,
  Locale,
  t,
  ValidationIssue,
  validationKey,
  WorkspaceResult,
} from '@palab/weaver-markdown';
import { readUserConfig } from './userConfig';
import { describeRef, rosterStore } from './rosterStore';

const EXCLUDE = '**/{node_modules,.git,dist,out,examples,.claude/worktrees}/**';
const MAX_FILES = 2000;
/** A repository's process file (DEC-015). A workspace may hold the folders of a few repositories. */
const PROCESS_FILE_GLOB = '**/.weaver/process.yaml';
const MAX_PROCESS_FILES = 20;

const PROCESS_FILE_PATH = '.weaver/process.yaml';

export interface Loaded extends WorkspaceResult {
  uris: Map<string, vscode.Uri>;
  markdownFileCount: number;
  /** Who tasks are judged against: the shared roster with the personal one laid over it (DEC-017). Absent when there is none. */
  roster?: Roster;
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

  // The process files of the repositories in the workspace are read first: the task fields a process
  // declares (DEC-016) are not unknown fields in the task files next to it.
  const processFiles = await vscode.workspace.findFiles(PROCESS_FILE_GLOB, EXCLUDE, MAX_PROCESS_FILES);
  // A process file may name the shared roster of its organization (`roster.from`, DEC-017); the first one found does.
  let rosterRef: RosterRef | undefined;
  let rosterRefPath: string | undefined;
  const processIssues: ValidationIssue[] = [];
  const declared: { root: string; fields: string[] }[] = [];
  for (const uri of processFiles) {
    const path = vscode.workspace.asRelativePath(uri, false);
    uris.set(path, uri);
    const parsed = parseProcess(path, decoder.decode(await vscode.workspace.fs.readFile(uri)));
    processIssues.push(...parsed.issues);
    if (parsed.process.task) declared.push({ root: path.slice(0, path.length - PROCESS_FILE_PATH.length), fields: parsed.process.task.fields.map((f) => f.name) });
    if (!rosterRef && parsed.rosterRef) {
      rosterRef = parsed.rosterRef;
      rosterRefPath = path;
    }
  }
  const loaded = loadWorkspace(files, { declaredTaskFields: (path) => declaredTaskFieldsOf(declared, path) });
  // The process files are checked too, so that a mistake shows in the Problems panel. A wrong
  // section keeps its defaults; nothing else changes here.
  loaded.issues.push(...processIssues);

  // Who works on, reviews, and approves a task is judged against the roster of the personal configuration
  // (DEC-013, DEC-014). With no roster there is nothing to judge against, so no problem is raised.
  const user = await readUserConfig();
  const personal = user.kind === 'ok' ? user.config.roster : undefined;
  // The repository's own reference wins over the personal one (DEC-017 item 5). The shared roster is read from
  // the copy kept on this computer; the Overview asks GitHub for a newer one.
  const ref = rosterRef ?? personal?.from;
  rosterStore.setCurrent(ref);
  const shared = rosterStore.shared();
  const where = rosterRefPath ?? '';
  if (shared && where) {
    loaded.issues.push(...shared.issues.map((issue) => ({ ...issue, path: where })));
    if (shared.state === 'missing') loaded.issues.push({ severity: 'warning', code: 'roster-shared-missing', args: { reference: describeRef(shared.ref) }, path: where });
    else if (rosterStore.isUnreadable(shared.ref)) loaded.issues.push({ severity: 'warning', code: 'roster-shared-unavailable', args: { reference: describeRef(shared.ref) }, path: where });
  }
  const combined = rosterStore.combined(personal)?.roster;
  // A roster that names a shared one but has no entry yet would make every owner a gap, so it judges nothing.
  const roster = combined && combined.contributors.length > 0 ? combined : undefined;
  if (roster) {
    for (const artifact of loaded.artifacts) {
      if (artifact.kind !== 'task') continue;
      for (const gap of rosterGaps(artifact, undefined, roster)) {
        loaded.issues.push({ severity: 'warning', code: gap.code.replace(/^gap\./, ''), ...(gap.args ? { args: gap.args } : {}), path: artifact.path });
      }
    }
  }
  return { ...loaded, uris, markdownFileCount: files.length, ...(roster ? { roster } : {}) };
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
