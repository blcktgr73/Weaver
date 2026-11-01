import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  acceptanceGaps,
  describeMove,
  evidenceGaps,
  formatNotice,
  KANBAN_COLUMNS,
  KanbanColumn,
  mergeTasks,
  MessageKey,
  Notice,
  parseIssueUrl,
  planMove,
  recordAcceptance,
  RequirementArtifact,
} from '@palab/weaver-markdown';
import { applyMove, fetchBoardItems, fetchEvidence, fetchIssue, getGitHubToken } from './github';
import { coverageOf } from './coverage';
import { currentLocale, message } from './locale';
import { processStore } from './processStore';
import { escapeHtml, isOpenableUrl, renderRequirementHtml, StatusState, TaskStatus } from './requirementHtml';
import { Loaded } from './workspace';

interface Panel {
  panel: vscode.WebviewPanel;
  requirement: RequirementArtifact;
  loaded: Loaded;
  uri: vscode.Uri | undefined;
  status: StatusState;
  /** True when the panel is a custom editor tab for the requirement file itself. */
  hosted: boolean;
  /** A task to scroll to, kept until the first status read has finished. */
  focusTask?: string;
}

/** Read-only view of one requirement: a side panel per requirement ID, or a custom editor tab per file. */
export class RequirementView {
  private readonly panels = new Set<Panel>();

  show(loaded: Loaded, requirement: RequirementArtifact, focusTask?: string): void {
    const existing = [...this.panels].find((p) => !p.hosted && p.requirement.id === requirement.id);
    if (existing) {
      existing.panel.reveal(undefined, true);
      existing.focusTask = focusTask;
      this.apply(existing, loaded, requirement);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'weaver.requirement',
      requirement.id,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: false },
    );
    this.open({ panel, requirement, loaded, uri: loaded.uris.get(requirement.path), status: { byTask: {}, loading: false }, hosted: false, focusTask });
  }

  /** Shows the view inside a custom editor tab that VS Code created for the requirement file. */
  attach(panel: vscode.WebviewPanel, loaded: Loaded, requirement: RequirementArtifact): void {
    this.open({ panel, requirement, loaded, uri: loaded.uris.get(requirement.path), status: { byTask: {}, loading: false }, hosted: true });
  }

  private open(entry: Panel): void {
    const { panel } = entry;
    this.panels.add(entry);

    panel.onDidDispose(() => this.panels.delete(entry));
    panel.webview.onDidReceiveMessage(async (message: { type: string; url?: string; taskId?: string; column?: string }) => {
      if (message.type === 'openSource' && entry.uri) {
        // `default` is the text editor even when Weaver is the default editor for the file.
        await vscode.commands.executeCommand('vscode.openWith', entry.uri, 'default', {
          viewColumn: entry.hosted ? vscode.ViewColumn.Active : vscode.ViewColumn.One,
        });
      } else if (message.type === 'showOnOverview') {
        await vscode.commands.executeCommand('weaver.showOnOverview', { requirementId: entry.requirement.id });
      } else if (message.type === 'openPreview' && entry.uri) {
        await vscode.commands.executeCommand('markdown.showPreviewToSide', entry.uri);
      } else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
      } else if (message.type === 'loadStatus') {
        await this.loadStatus(entry, true);
      } else if (message.type === 'moveTask' && message.taskId && message.column) {
        await this.moveTask(entry, message.taskId, message.column);
      } else if (message.type === 'acceptRequirement') {
        await this.acceptRequirement(entry);
      }
    });
    this.render(entry);
    // Already signed in? Load without prompting.
    void this.loadStatus(entry, false);
  }

  /** Re-render open panels after the workspace was re-read. */
  update(loaded: Loaded): void {
    for (const entry of this.panels) {
      const id = entry.requirement.id;
      const requirement = loaded.artifacts.find((a) => a.kind === 'requirement' && a.id === id);
      if (requirement?.kind === 'requirement') {
        this.apply(entry, loaded, requirement);
      } else {
        entry.panel.webview.html = `<body style="padding:24px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)">${escapeHtml(message('ui.panel.invalid', { id }))}</body>`;
      }
    }
  }

  /** The requirement's task list joined with its task files (DEC-005). */
  private tasksOf(entry: Panel) {
    return mergeTasks(entry.requirement, entry.loaded.artifacts);
  }

  private apply(entry: Panel, loaded: Loaded, requirement: RequirementArtifact): void {
    entry.requirement = requirement;
    entry.loaded = loaded;
    entry.uri = loaded.uris.get(requirement.path);
    this.render(entry);
  }

  private async loadStatus(entry: Panel, interactive: boolean): Promise<void> {
    if (entry.status.loading) return;
    entry.status = { ...entry.status, loading: true };
    this.render(entry);

    try {
      const token = await getGitHubToken(interactive);
      if (!token) {
        entry.status = { byTask: entry.status.byTask, loading: false };
        return;
      }
      // Only the repositories of this requirement's tasks are asked for their process (DEC-015).
      const repositories = [...new Set(this.tasksOf(entry).flatMap((task) => { const ref = task.issueUrl ? parseIssueUrl(task.issueUrl) : undefined; return ref ? [`${ref.owner}/${ref.repo}`] : []; }))];
      await processStore.refresh(token, repositories);
      const results = await Promise.all(
        this.tasksOf(entry).map(async (task) => {
          if (!task.issueUrl) return undefined;
          const [issue, evidence, board] = await Promise.all([
            fetchIssue(token, task.issueUrl),
            fetchEvidence(token, task.issueUrl),
            fetchBoardItems(token, task.issueUrl),
          ]);
          const ref = parseIssueUrl(task.issueUrl);
          const rules = ref ? processStore.rulesFor(`${ref.owner}/${ref.repo}`) : undefined;
          const boardStatus = (board?.find((item) => item.project === entry.requirement.githubProject) ?? board?.[0])?.status;
          const status: TaskStatus = issue.ok
            ? {
                ok: true,
                issue: issue.issue,
                ...(rules ? { rules } : {}),
                ...(boardStatus ? { boardStatus } : {}),
                ...(evidence.ok ? { evidence: evidence.evidence } : { evidenceError: evidence.error }),
                ...(board ? { board } : {}),
              }
            : issue;
          return [task.id, status] as const;
        }),
      );
      const byTask: StatusState['byTask'] = {};
      for (const item of results) if (item) byTask[item[0]] = item[1];
      entry.status = { byTask, loading: false };
    } catch (error) {
      entry.status = { byTask: entry.status.byTask, loading: false };
      void vscode.window.showWarningMessage(message('ui.msg.status-read-failed', { detail: (error as Error).message }));
    } finally {
      if (this.panels.has(entry)) this.render(entry);
      entry.focusTask = undefined;
    }
  }

  private async moveTask(entry: Panel, taskId: string, columnName: string): Promise<void> {
    const column = KANBAN_COLUMNS.find((c) => c === columnName) as KanbanColumn | undefined;
    const task = this.tasksOf(entry).find((t) => t.id === taskId);
    const current = entry.status.byTask[taskId];
    if (!column || !task?.issueUrl || !current?.ok) return;

    const plan = planMove({ ...current.issue, boardStatus: current.boardStatus }, column, current.rules);
    if (plan.unavailable) {
      void vscode.window.showWarningMessage(message('ui.msg.move-unavailable', { task: taskId, column: message(`column.${column}` as MessageKey) }));
      this.render(entry);
      return;
    }
    if (plan.noop) {
      this.render(entry);
      return;
    }

    const locale = currentLocale();
    const lines = describeMove(plan, current.issue).map((line) => formatNotice(line, locale));
    const missing =
      column === 'Verified' ? evidenceGaps('Verified', current.evidence).map((gap) => formatNotice(gap, locale)) : [];
    const warning =
      column === 'Verified'
        ? `\n\n${message('ui.dialog.verified-warning')}${
            missing.length ? `\n${message('ui.dialog.evidence-gaps', { gaps: missing.join('; ') })}` : ''
          }`
        : '';
    const detail = `${message('ui.dialog.move-detail', { number: current.issue.number })}\n- ${lines.join('\n- ')}${warning}`;
    const columnLabel = message(`column.${column}` as MessageKey);
    const moveLabel = message('ui.dialog.move-button');
    const choice = await vscode.window.showWarningMessage(
      message('ui.dialog.move-title', { task: taskId, column: columnLabel }),
      { modal: true, detail },
      moveLabel,
    );
    if (choice !== moveLabel) {
      this.render(entry); // put the selector back
      return;
    }

    const token = await getGitHubToken(true, ['repo', 'project']);
    if (!token) {
      this.render(entry);
      return;
    }
    const steps = await applyMove(token, task.issueUrl, plan);
    const text = (notice: Notice | undefined): string => (notice ? formatNotice(notice, locale) : '');
    const failed = steps.find((s) => !s.ok);
    if (failed) {
      const done =steps.filter((s) => s.ok).map((s) => text(s.name)).join('; ') || message('ui.msg.move-nothing');
      void vscode.window.showErrorMessage(
        message('ui.msg.move-stopped', { step: text(failed.name), detail: text(failed.detail), done }),
      );
    } else {
      const note = steps
        .filter((s) => s.skipped)
        .map((s) => text(s.detail))
        .join(' ');
      void vscode.window.showInformationMessage(
        `${message('ui.msg.move-done', { task: taskId, column: columnLabel })}${note ? ' ' + note : ''}`,
      );
    }
    await this.loadStatus(entry, false);
  }

  /**
   * Records acceptance in the requirement file after showing what is still open.
   * Acceptance is a human decision: Weaver lists the open items and asks.
   */
  private async acceptRequirement(entry: Panel): Promise<void> {
    const { requirement } = entry;
    if (requirement.status === 'accepted') {
      void vscode.window.showInformationMessage(message('ui.msg.accept-already', { id: requirement.id }));
      return;
    }
    if (Object.keys(entry.status.byTask).length === 0 || !entry.uri) {
      void vscode.window.showInformationMessage(message('ui.msg.accept-load-first'));
      return;
    }

    const locale = currentLocale();
    const tasks = this.tasksOf(entry);
    const open = acceptanceGaps(coverageOf(requirement, tasks, entry.status), tasks, locale);
    const detail = [
      message('ui.dialog.accept-edit', { path: requirement.path }),
      open.length > 0
        ? [message('ui.dialog.accept-open'), ...open.map((line) => `- ${line}`)].join('\n')
        : message('ui.dialog.accept-none'),
      message('ui.dialog.accept-note'),
    ].join('\n\n');
    const acceptLabel = message('ui.dialog.accept-button');
    const choice = await vscode.window.showWarningMessage(
      message('ui.dialog.accept-title', { id: requirement.id }),
      { modal: true, detail },
      acceptLabel,
    );
    if (choice !== acceptLabel) return;

    const session = await vscode.authentication.getSession('github', ['repo'], { silent: true });
    const by = session?.account.label ?? (await vscode.window.showInputBox({ prompt: message('ui.prompt.accepted-by') }));
    if (!by) return;

    const document = await vscode.workspace.openTextDocument(entry.uri);
    const updated = recordAcceptance(document.getText(), by, new Date().toISOString().slice(0, 10));
    if (updated === undefined) {
      void vscode.window.showErrorMessage(message('ui.msg.accept-failed', { path: requirement.path }));
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(entry.uri, new vscode.Range(0, 0, document.lineCount, 0), updated);
    await vscode.workspace.applyEdit(edit);
    await document.save();
    void vscode.window.showInformationMessage(message('ui.msg.accepted', { id: requirement.id, by }));
  }

  private render(entry: Panel): void {
    const { panel, requirement, loaded } = entry;
    const nonce = randomBytes(16).toString('hex');
    const issues = loaded.issues.filter((issue) => issue.path === requirement.path);
    if (!entry.hosted) panel.title = `${requirement.id} ${requirement.title}`;
    panel.webview.html = renderRequirementHtml(requirement, this.tasksOf(entry), issues, nonce, panel.webview.cspSource, entry.status, currentLocale(), entry.focusTask);
  }
}
