import {
  describePull,
  evidenceGaps,
  formatNotice,
  groupByColumn,
  IssueSnapshot,
  KANBAN_COLUMNS,
  KanbanPlacement,
  Locale,
  placeIssue,
  RequirementArtifact,
  t,
  TaskEvidence,
  ValidationIssue,
  validationKey,
} from '@palab/weaver-markdown';

export type TaskStatus =
  | { ok: true; issue: IssueSnapshot; evidence?: TaskEvidence; evidenceError?: string }
  | { ok: false; error: string };

export interface StatusState {
  /** Task ID to the result of reading its Issue. */
  byTask: Record<string, TaskStatus>;
  loading: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only GitHub web links are allowed to leave the panel. */
export function isOpenableUrl(url: string): boolean {
  return /^https:\/\/github\.com\//.test(url);
}

const STATUS_NOTE: Record<string, string> = {
  verified: 'Verified status is not the same as accepted. Acceptance is a human decision.',
};

export function renderRequirementHtml(
  requirement: RequirementArtifact,
  issues: ValidationIssue[],
  nonce: string,
  cspSource: string,
  status?: StatusState,
  locale: Locale = 'en',
): string {
  const e = escapeHtml;
  const meta: [string, string | undefined][] = [
    ['Owner', requirement.owner],
    ['Repository', requirement.repository],
    ['Project', requirement.githubProject],
    ['Stories', requirement.storyIds.join(', ') || undefined],
    ['Source', requirement.path],
  ];

  const metaHtml = meta
    .map(([label, value]) => `<dt>${label}</dt><dd>${value ? e(value) : '<span class="muted">not set</span>'}</dd>`)
    .join('');

  const criteriaHtml = requirement.criteria.length
    ? `<ol class="plain">${requirement.criteria
        .map((c) => `<li><span class="tag">${e(c.id)}</span> ${e(c.text)}</li>`)
        .join('')}</ol>
       <p class="muted">Criteria are not yet mapped to tasks or evidence.</p>`
    : '<p class="empty">No acceptance criteria found under “## Acceptance criteria”.</p>';

  const loaded = status !== undefined && Object.keys(status.byTask).length > 0;
  const placed = new Map<string, { issue: IssueSnapshot; placement: KanbanPlacement }>();
  for (const task of requirement.tasks) {
    const result = status?.byTask[task.id];
    if (result?.ok) placed.set(task.id, { issue: result.issue, placement: placeIssue(result.issue) });
  }

  /** Placement gaps plus evidence gaps for a task whose Issue was read. */
  const allGaps = (taskId: string): string[] => {
    const result = status?.byTask[taskId];
    const entry = placed.get(taskId);
    if (!result?.ok || !entry) return [];
    const evidence = result.evidenceError
      ? [`evidence: ${result.evidenceError}`]
      : evidenceGaps(entry.placement.column, result.evidence).map((gap) => formatNotice(gap, locale));
    return [...entry.placement.gaps.map((gap) => formatNotice(gap, locale)), ...evidence];
  };

  const evidenceCell = (taskId: string): string => {
    const result = status?.byTask[taskId];
    if (!result?.ok) return '<span class="muted">—</span>';
    if (result.evidenceError) return `<span class="warn small">${e(result.evidenceError)}</span>`;
    const pulls = result.evidence?.pulls ?? [];
    if (pulls.length === 0) return '<span class="muted">no PR</span>';
    return pulls
      .map((p) => `<div class="small"><a href="#" data-url="${e(p.url)}" title="${e(p.title)}">${e(describePull(p, locale))}</a></div>`)
      .join('');
  };

  const statusCell = (taskId: string): string => {
    const result = status?.byTask[taskId];
    if (!result) return '<span class="muted">—</span>';
    if (!result.ok) return `<span class="warn">${e(result.error)}</span>`;
    const entry = placed.get(taskId);
    if (!entry) return '<span class="muted">—</span>';
    const gaps = allGaps(taskId).map((g) => `<div class="warn small">${e(g)}</div>`).join('');
    const options = KANBAN_COLUMNS.map(
      (c) => `<option value="${e(c)}"${c === entry.placement.column ? ' selected' : ''}>${e(c)}</option>`,
    ).join('');
    return `<span class="col-badge">${e(entry.placement.column)}</span>${gaps}
      <div><select data-move="${e(taskId)}" title="Move to another column (asks for confirmation)" aria-label="Move ${e(taskId)}">${options}</select></div>`;
  };

  const tasksHtml = requirement.tasks.length
    ? `<table><thead><tr><th>Task</th><th>Title</th><th>Issue</th><th>Status</th><th>Evidence</th><th>Owner</th></tr></thead><tbody>${requirement.tasks
        .map((t) => {
          const link =
            t.issueUrl && isOpenableUrl(t.issueUrl)
              ? `<a href="#" data-url="${e(t.issueUrl)}">#${t.issueNumber ?? 'open'}</a>`
              : '<span class="warn">not linked</span>';
          const owners = placed.get(t.id)?.issue.assignees ?? [];
          const owner = status?.byTask[t.id] ? (owners.length ? e(owners.join(', ')) : '<span class="muted">unassigned</span>') : '<span class="muted">—</span>';
          return `<tr><td><span class="tag">${e(t.id)}</span></td><td>${e(t.title)}</td><td>${link}</td><td>${statusCell(t.id)}</td><td>${evidenceCell(t.id)}</td><td>${owner}</td></tr>`;
        })
        .join('')}</tbody></table>
       <div class="actions"><button data-cmd="loadStatus"${status?.loading ? ' disabled' : ''}>${
         status?.loading ? 'Loading…' : loaded ? 'Refresh issue status' : 'Load issue status'
       }</button></div>
       <p class="muted small">Reading uses your VS Code GitHub sign-in. Changing a column edits GitHub (labels, Issue state, board Status) and always asks first.</p>`
    : '<p class="empty">No tasks found under “## Tasks”.</p>';

  let boardHtml = '';
  if (loaded) {
    const cards = requirement.tasks.flatMap((t) => {
      const entry = placed.get(t.id);
      return entry ? [{ task: t, issue: entry.issue, placement: entry.placement }] : [];
    });
    const grouped = groupByColumn(cards);
    const off = requirement.tasks.filter((t) => !placed.has(t.id));
    boardHtml = `<h2>Board</h2>
      <div class="board">${KANBAN_COLUMNS.map(
        (column) => `<div class="lane"><h3>${e(column)} <span class="muted">${grouped[column].length}</span></h3>${grouped[column]
          .map(
            (c) => `<div class="card"><span class="tag">${e(c.task.id)}</span> ${e(c.task.title)}
              <div class="muted small">${c.issue.assignees.length ? e(c.issue.assignees.join(', ')) : 'unassigned'}</div>
              ${allGaps(c.task.id).map((g) => `<div class="warn small">${e(g)}</div>`).join('')}</div>`,
          )
          .join('')}</div>`,
      ).join('')}</div>
      ${off.length ? `<p class="muted small">Not on the board: ${off.map((t) => e(t.id)).join(', ')} (no readable Issue).</p>` : ''}`;
  }

  let evidenceHtml =
    '<p class="muted">Load issue status to see the pull requests and checks linked to each task.</p>';
  if (loaded) {
    const withGaps = requirement.tasks
      .map((t) => ({ t, gaps: allGaps(t.id) }))
      .filter((x) => status?.byTask[x.t.id]?.ok && x.gaps.length > 0);
    evidenceHtml = withGaps.length
      ? `<ul class="plain">${withGaps
          .map((x) => `<li><span class="tag">${e(x.t.id)}</span> <span class="warn">${x.gaps.map(e).join('; ')}</span></li>`)
          .join('')}</ul>`
      : '<p class="ok">No evidence gaps among the tasks that were read.</p>';
    evidenceHtml += `<p class="muted small">Pull requests are found by references to the Issue. A reference is a link, not proof the change implements the task. Weaver reports gaps; acceptance stays a human decision.</p>`;
  }

  const gapsHtml = issues.length
    ? `<ul class="plain">${issues
        .map((i) => `<li class="${i.severity}"><strong>${i.severity}</strong> ${e(t(validationKey(i.code), locale, i.args))}</li>`)
        .join('')}</ul>`
    : '<p class="ok">No validation gaps.</p>';

  const note = STATUS_NOTE[requirement.status];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(requirement.id)}</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 24px 48px; line-height: 1.5; max-width: 1100px; }
  h1 { font-size: 1.6em; margin: 4px 0 12px; }
  h2 { font-size: 1.1em; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
  .idline { margin-top: 20px; font-weight: 600; color: var(--vscode-descriptionForeground); }
  .badge { margin-left: 8px; padding: 1px 8px; border-radius: 10px; font-size: 0.85em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .tag { white-space: nowrap; font-family: var(--vscode-editor-font-family); font-size: 0.9em; color: var(--vscode-textLink-foreground); }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 16px; margin: 0; }
  dt { color: var(--vscode-descriptionForeground); }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid var(--vscode-panel-border); }
  th { color: var(--vscode-descriptionForeground); font-weight: 500; }
  ol.plain, ul.plain { padding-left: 0; list-style: none; margin: 0; }
  ol.plain li, ul.plain li { padding: 3px 0; }
  .muted, .empty { color: var(--vscode-descriptionForeground); }
  .warn, li.warning strong { color: var(--vscode-editorWarning-foreground); }
  li.error strong { color: var(--vscode-editorError-foreground); }
  .ok { color: var(--vscode-testing-iconPassed, var(--vscode-foreground)); }
  .small { font-size: 0.85em; }
  .col-badge { padding: 1px 8px; border-radius: 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 0.85em; white-space: nowrap; }
  .board { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
  .lane { background: var(--vscode-sideBar-background, transparent); border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 6px 8px; min-height: 60px; }
  .lane h3 { font-size: 0.9em; margin: 0 0 6px; }
  .card { overflow-wrap: anywhere; border: 1px solid var(--vscode-panel-border); border-radius: 3px; padding: 6px; margin-bottom: 6px; background: var(--vscode-editor-background); }
  select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); margin-top: 4px; }
  button:disabled { opacity: 0.6; cursor: default; }
  .actions { margin-top: 14px; display: flex; gap: 8px; }
  button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 0; padding: 5px 12px; border-radius: 2px; cursor: pointer; }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  a { color: var(--vscode-textLink-foreground); }
</style>
</head>
<body>
  <div class="idline">${e(requirement.id)}<span class="badge">${e(requirement.status)}</span></div>
  <h1>${e(requirement.title)}</h1>
  ${note ? `<p class="muted">${e(note)}</p>` : ''}
  <dl>${metaHtml}</dl>
  <div class="actions">
    <button data-cmd="openSource">Open source</button>
    <button data-cmd="openPreview">Open preview</button>
  </div>

  <h2>Acceptance criteria (${requirement.criteria.length})</h2>
  ${criteriaHtml}

  <h2>Tasks (${requirement.tasks.length})</h2>
  ${tasksHtml}

  ${boardHtml}

  <h2>Gaps and checks (${issues.length})</h2>
  ${gapsHtml}

  <h2>Evidence</h2>
  ${evidenceHtml}

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-move]');
    if (select) vscode.postMessage({ type: 'moveTask', taskId: select.dataset.move, column: select.value });
  });
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-cmd],[data-url]');
    if (!target) return;
    event.preventDefault();
    if (target.dataset.cmd) vscode.postMessage({ type: target.dataset.cmd });
    if (target.dataset.url) vscode.postMessage({ type: 'openUrl', url: target.dataset.url });
  });
</script>
</body>
</html>`;
}
