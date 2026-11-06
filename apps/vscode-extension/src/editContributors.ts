import { promises as fs } from 'node:fs';
import * as vscode from 'vscode';
import {
  contributorFromForm,
  parseRoster,
  reachLabel,
  removeContributor,
  upsertContributor,
  validationKey,
  type Contributor,
  type MessageArgs,
  type RosterEdit,
  type RosterTarget,
} from '@palab/weaver-markdown';
import { message } from './locale';
import { openConfigFile } from './chooseRepositories';
import { readUserConfig, writeUserConfig } from './userConfig';

/** The roster being changed: its text, where it is written, and which list of the file holds the entries. */
interface Source {
  target: RosterTarget;
  path: string;
  text: string;
  contributors: Contributor[];
}

/** One line for the confirmation: who, what kind, and what is set. */
function summarize(contributor: Contributor): string {
  const parts = [`${contributor.id} (${contributor.kind})`];
  if (contributor.name) parts.push(contributor.name);
  if (contributor.github) parts.push(`@${contributor.github}`);
  if (contributor.tool) parts.push(contributor.tool);
  if (contributor.model) parts.push(contributor.model);
  if (contributor.roles?.length) parts.push(`[${contributor.roles.join(', ')}]`);
  const label = reachLabel(contributor);
  if (label) parts.push(`label: ${label}`);
  return parts.join(' · ');
}

/** Why an edit was refused, in words. */
function refusal(edit: Extract<RosterEdit, { ok: false }>, path: string, id: string): string {
  const args: MessageArgs = { path, id, detail: edit.detail ?? '' };
  if (edit.issue) return message('ui.roster.refused', { detail: messageOfRule(edit.issue.code, edit.issue.args) });
  const key = edit.reason === 'not-found' ? 'ui.roster.not-found' : edit.reason === 'not-a-list' ? 'ui.roster.not-a-list' : 'ui.roster.invalid-yaml';
  return message('ui.roster.refused', { detail: message(key, args) });
}

function messageOfRule(code: string, args?: MessageArgs): string {
  return message(validationKey(code), args);
}

/** The personal roster, or a roster file the person picks. Nothing is read from a repository (DEC-017). */
async function chooseSource(): Promise<Source | undefined> {
  const user = await readUserConfig();
  const personal = message('ui.roster.target-personal');
  const file = message('ui.roster.target-file');
  const pick = await vscode.window.showQuickPick(
    [
      { label: personal, description: user.kind === 'none' ? undefined : user.path, target: 'personal' as const },
      { label: file, description: message('ui.roster.target-file-detail'), target: 'file' as const },
    ],
    { placeHolder: message('ui.roster.target-placeholder'), ignoreFocusOut: true },
  );
  if (!pick) return undefined;

  if (pick.target === 'personal') {
    if (user.kind === 'none') {
      void vscode.window.showInformationMessage(message('ui.roster.no-config'));
      return undefined;
    }
    if (user.kind === 'invalid') {
      const open = message('ui.repos.open-config');
      const choice = await vscode.window.showWarningMessage(message('ui.repos.invalid-config', { path: user.path }), open);
      if (choice === open) await openConfigFile();
      return undefined;
    }
    return { target: 'personal', path: user.path, text: user.text, contributors: user.config.roster?.contributors ?? [] };
  }

  const [uri] =
    (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { YAML: ['yaml', 'yml'] }, openLabel: message('ui.roster.file-open') })) ?? [];
  if (!uri) return undefined;
  const text = await fs.readFile(uri.fsPath, 'utf8');
  // A file with no entries yet is a fine place to start; one that is broken is left alone.
  const parsed = text.trim() === '' ? { roster: { contributors: [] as Contributor[] }, issues: [] } : parseRoster(uri.fsPath, text);
  const error = parsed.issues.find((issue) => issue.severity === 'error' && issue.code !== 'roster-no-contributors');
  if (!parsed.roster && error) {
    void vscode.window.showWarningMessage(message('ui.roster.file-unreadable', { path: uri.fsPath, detail: messageOfRule(error.code, error.args) }));
    return undefined;
  }
  return { target: 'file', path: uri.fsPath, text, contributors: parsed.roster?.contributors ?? [] };
}

async function ask(prompt: string, value = '', required = false): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt,
    value,
    ignoreFocusOut: true,
    validateInput: (input) => (required && input.trim() === '' ? ' ' : undefined),
  });
}

/** The questions of the form, in order. `undefined` when the person cancels at any step. */
async function askForm(existing?: Contributor): Promise<Contributor | undefined> {
  const id = await ask(message('ui.roster.id-prompt'), existing?.id, true);
  if (id === undefined) return undefined;
  const kind = await vscode.window.showQuickPick(
    [
      { label: message('ui.roster.kind-human'), value: 'human' as const },
      { label: message('ui.roster.kind-agent'), value: 'agent' as const },
    ].sort((a, b) => (a.value === existing?.kind ? -1 : b.value === existing?.kind ? 1 : 0)),
    { placeHolder: message('ui.roster.kind-placeholder'), ignoreFocusOut: true },
  );
  if (!kind) return undefined;
  const name = await ask(message('ui.roster.name-prompt'), existing?.name);
  if (name === undefined) return undefined;
  const github = await ask(message('ui.roster.github-prompt'), existing?.github);
  if (github === undefined) return undefined;

  let tool = '';
  let model = '';
  let label = '';
  if (kind.value === 'agent') {
    const answerTool = await ask(message('ui.roster.tool-prompt'), existing?.tool);
    if (answerTool === undefined) return undefined;
    const answerModel = await ask(message('ui.roster.model-prompt'), existing?.model);
    if (answerModel === undefined) return undefined;
    const answerLabel = await ask(message('ui.roster.label-prompt'), reachLabel(existing));
    if (answerLabel === undefined) return undefined;
    tool = answerTool;
    model = answerModel;
    label = answerLabel;
  }
  const roles = await ask(message('ui.roster.roles-prompt'), existing?.roles?.join(', '));
  if (roles === undefined) return undefined;
  return contributorFromForm({ id, kind: kind.value, name, github, tool, model, roles, label }, existing);
}

/**
 * Adds, changes, or removes a contributor of the personal roster or of a roster file in a local
 * clone, after showing the change (TASK-075, DEC-017). Only the entry changes; the comments of the
 * file stay. A referenced repository is never written to. True when a file was written.
 */
export async function editContributors(): Promise<boolean> {
  const source = await chooseSource();
  if (!source) return false;

  const add = message('ui.roster.add');
  const pick = await vscode.window.showQuickPick(
    [
      { label: `$(add) ${add}`, existing: undefined as Contributor | undefined },
      ...source.contributors.map((c) => ({ label: c.id, description: summarize(c).slice(c.id.length), existing: c as Contributor | undefined })),
    ],
    { placeHolder: message('ui.roster.pick-placeholder'), ignoreFocusOut: true },
  );
  if (!pick) return false;

  let edit: RosterEdit;
  let question: string;
  let summary: string;
  let id: string;
  if (!pick.existing) {
    const form = await askForm();
    if (!form) return false;
    id = form.id;
    edit = upsertContributor(source.text, form, source.target);
    question = message('ui.roster.confirm-add', { id, path: source.path });
    summary = summarize(form);
  } else {
    id = pick.existing.id;
    const change = message('ui.roster.change');
    const remove = message('ui.roster.remove');
    const action = await vscode.window.showQuickPick([{ label: change }, { label: remove }], {
      placeHolder: message('ui.roster.action-placeholder', { id }),
      ignoreFocusOut: true,
    });
    if (!action) return false;
    if (action.label === remove) {
      edit = removeContributor(source.text, id, source.target);
      question = message('ui.roster.confirm-remove', { id, path: source.path });
      summary = summarize(pick.existing);
    } else {
      const form = await askForm(pick.existing);
      if (!form) return false;
      edit = upsertContributor(source.text, form, source.target, id);
      question = message('ui.roster.confirm-change', { id, path: source.path });
      summary = `${summarize(pick.existing)}\n→ ${summarize(form)}`;
    }
  }

  if (!edit.ok) {
    void vscode.window.showWarningMessage(refusal(edit, source.path, id));
    return false;
  }
  const write = message('ui.repos.write');
  const detail = message('ui.roster.confirm-detail', { summary }) + (source.target === 'personal' ? `\n${message('ui.roster.backup-note')}` : '');
  const answer = await vscode.window.showInformationMessage(question, { modal: true, detail }, write);
  if (answer !== write) return false;

  if (source.target === 'personal') await writeUserConfig(edit.text, source.text);
  else await fs.writeFile(source.path, edit.text, 'utf8');
  void vscode.window.showInformationMessage(message('ui.repos.written', { path: source.path }));
  return true;
}
