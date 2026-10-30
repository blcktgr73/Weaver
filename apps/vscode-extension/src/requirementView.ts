import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  describeMove,
  evidenceGaps,
  formatNotice,
  KANBAN_COLUMNS,
  KanbanColumn,
  mergeTasks,
  MessageKey,
  Notice,
  planMove,
  RequirementArtifact,
} from '@palab/weaver-markdown';
import { applyMove, fetchEvidence, fetchIssue, getGitHubToken } from './github';
import { currentLocale, message } from './locale';
import { escapeHtml, isOpenableUrl, renderRequirementHtml, StatusState, TaskStatus } from './requirementHtml';
import { Loaded } from './workspace';

interface Panel {
  panel: vscode.WebviewPanel;
  requirement: RequirementArtifact;
  loaded: Loaded;
  uri: vscode.Uri | undefined;
  status: StatusState;
}

/** Read-only view of one requirement. One panel per requirement ID. */
export class RequirementView {
  private readonly panels = new Map<string, Panel>();

  show(loaded: Loaded, requirement: RequirementArtifact): void {
    const existing = this.panels.get(requirement.id);
    if (existing) {
      existing.panel.reveal(undefined, true);
      this.apply(existing, loaded, requirement);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'weaver.requirement',
      requirement.id,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: false },
    );
    const entry: Panel = {
      panel,
      requirement,
      loaded,
      uri: loaded.uris.get(requirement.path),
      status: { byTask: {}, loading: false },
    };
    this.panels.set(requirement.id, entry);

    panel.onDidDispose(() => this.panels.delete(requirement.id));
    panel.webview.onDidReceiveMessage(async (message: { type: string; url?: string; taskId?: string; column?: string }) => {
      if (message.type === 'openSource' && entry.uri) {
        await vscode.window.showTextDocument(entry.uri, { viewColumn: vscode.ViewColumn.One });
      } else if (message.type === 'openPreview' && entry.uri) {
        await vscode.commands.executeCommand('markdown.showPreviewToSide', entry.uri);
      } else if (message.type === 'openUrl' && message.url && isOpenableUrl(message.url)) {
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
      } else if (message.type === 'loadStatus') {
        await this.loadStatus(entry, true);
      } else if (message.type === 'moveTask' && message.taskId && message.column) {
        await this.moveTask(entry, message.taskId, message.column);
      }
    });
    this.render(entry);
    // Already signed in? Load without prompting.
    void this.loadStatus(entry, false);
  }

  /** Re-render open panels after the workspace was re-read. */
  update(loaded: Loaded): void {
    for (const [id, entry] of this.panels) {
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
      const results = await Promise.all(
        this.tasksOf(entry).map(async (task) => {
          if (!task.issueUrl) return undefined;
          const [issue, evidence] = await Promise.all([
            fetchIssue(token, task.issueUrl),
            fetchEvidence(token, task.issueUrl),
          ]);
          const status: TaskStatus = issue.ok
            ? { ok: true, issue: issue.issue, ...(evidence.ok ? { evidence: evidence.evidence } : { evidenceError: evidence.error }) }
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
      if (this.panels.get(entry.requirement.id) === entry) this.render(entry);
    }
  }

  private async moveTask(entry: Panel, taskId: string, columnName: string): Promise<void> {
    const column = KANBAN_COLUMNS.find((c) => c === columnName) as KanbanColumn | undefined;
    const task = this.tasksOf(entry).find((t) => t.id === taskId);
    const current = entry.status.byTask[taskId];
    if (!column || !task?.issueUrl || !current?.ok) return;

    const plan = planMove(current.issue, column);
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

  private render(entry: Panel): void {
    const { panel, requirement, loaded } = entry;
    const nonce = randomBytes(16).toString('hex');
    const issues = loaded.issues.filter((issue) => issue.path === requirement.path);
    panel.title = `${requirement.id} ${requirement.title}`;
    panel.webview.html = renderRequirementHtml(requirement, this.tasksOf(entry), issues, nonce, panel.webview.cspSource, entry.status, currentLocale());
  }
}
