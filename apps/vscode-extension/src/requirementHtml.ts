import {
  describePull,
  evidenceGaps,
  formatNotice,
  groupByColumn,
  IssueSnapshot,
  KANBAN_COLUMNS,
  KanbanPlacement,
  Locale,
  MergedTask,
  MessageArgs,
  MessageKey,
  Notice,
  ownerGaps,
  ownerOf,
  placeIssue,
  RequirementArtifact,
  t,
  TaskEvidence,
  ValidationIssue,
  validationKey,
} from '@palab/weaver-markdown';

export type TaskStatus =
  | { ok: true; issue: IssueSnapshot; evidence?: TaskEvidence; evidenceError?: Notice }
  | { ok: false; error: Notice };

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

const STATUS_NOTE: Record<string, MessageKey> = {
  verified: 'ui.note.verified',
};

export function renderRequirementHtml(
  requirement: RequirementArtifact,
  tasks: MergedTask[],
  issues: ValidationIssue[],
  nonce: string,
  cspSource: string,
  status?: StatusState,
  locale: Locale = 'en',
): string {
  const e = escapeHtml;
  const tt = (key: MessageKey, args?: MessageArgs): string => t(key, locale, args);
  const column = (name: string): string => tt(`column.${name}` as MessageKey);
  const meta: [string, string | undefined][] = [
    [tt('ui.meta.owner'), requirement.owner],
    [tt('ui.meta.repository'), requirement.repository],
    [tt('ui.meta.project'), requirement.githubProject],
    [tt('ui.meta.stories'), requirement.storyIds.join(', ') || undefined],
    [tt('ui.meta.source'), requirement.path],
  ];

  const metaHtml = meta
    .map(([label, value]) => `<dt>${e(label)}</dt><dd>${value ? e(value) : `<span class="muted">${e(tt('ui.not-set'))}</span>`}</dd>`)
    .join('');

  const criteriaHtml = requirement.criteria.length
    ? `<ol class="plain">${requirement.criteria
        .map((c) => `<li><span class="tag">${e(c.id)}</span> ${e(c.text)}</li>`)
        .join('')}</ol>
       <p class="muted">${e(tt('ui.criteria.unmapped'))}</p>`
    : `<p class="empty">${e(tt('ui.criteria.empty'))}</p>`;

  const loaded = status !== undefined && Object.keys(status.byTask).length > 0;
  const placed = new Map<string, { issue: IssueSnapshot; placement: KanbanPlacement }>();
  for (const task of tasks) {
    const result = status?.byTask[task.id];
    if (result?.ok) placed.set(task.id, { issue: result.issue, placement: placeIssue(result.issue) });
  }

  /** Placement gaps plus evidence gaps for a task whose Issue was read. */
  const allGaps = (taskId: string): string[] => {
    const result = status?.byTask[taskId];
    const entry = placed.get(taskId);
    if (!result?.ok || !entry) return [];
    const evidence = result.evidenceError
      ? [tt('ui.evidence.error-prefix', { detail: formatNotice(result.evidenceError, locale) })]
      : evidenceGaps(entry.placement.column, result.evidence).map((gap) => formatNotice(gap, locale));
    const task = tasks.find((candidate) => candidate.id === taskId);
    const owner = task ? ownerGaps(entry.placement.column, ownerOf(task, entry.issue.assignees)).map((gap) => formatNotice(gap, locale)) : [];
    return [...entry.placement.gaps.map((gap) => formatNotice(gap, locale)), ...owner, ...evidence];
  };

  /** The recorded owner (task file), or the Issue assignee as a hint. */
  const ownerHtml = (task: MergedTask): string => {
    const owner = ownerOf(task, placed.get(task.id)?.issue.assignees);
    if (!owner) {
      return status?.byTask[task.id] ? `<span class="muted">${e(tt('ui.owner.unassigned'))}</span>` : '<span class="muted">—</span>';
    }
    const note = owner.type ? tt(`ui.owner.${owner.type}`) : owner.source === 'issue' ? tt('ui.owner.from-issue') : '';
    return `${e(owner.name)}${note ? ` <span class="muted small">· ${e(note)}</span>` : ''}`;
  };

  const evidenceCell = (taskId: string): string => {
    const result = status?.byTask[taskId];
    if (!result?.ok) return '<span class="muted">—</span>';
    if (result.evidenceError) return `<span class="warn small">${e(formatNotice(result.evidenceError, locale))}</span>`;
    const pulls = result.evidence?.pulls ?? [];
    if (pulls.length === 0) return `<span class="muted">${e(tt('ui.evidence.no-pr'))}</span>`;
    return pulls
      .map((p) => `<div class="small"><a href="#" data-url="${e(p.url)}" title="${e(p.title)}">${e(describePull(p, locale))}</a></div>`)
      .join('');
  };

  const statusCell = (taskId: string): string => {
    const result = status?.byTask[taskId];
    if (!result) return '<span class="muted">—</span>';
    if (!result.ok) return `<span class="warn">${e(formatNotice(result.error, locale))}</span>`;
    const entry = placed.get(taskId);
    if (!entry) return '<span class="muted">—</span>';
    const gaps = allGaps(taskId).map((g) => `<div class="warn small">${e(g)}</div>`).join('');
    const options = KANBAN_COLUMNS.map(
      (c) => `<option value="${e(c)}"${c === entry.placement.column ? ' selected' : ''}>${e(column(c))}</option>`,
    ).join('');
    return `<span class="col-badge">${e(column(entry.placement.column))}</span>${gaps}
      <div><select data-move="${e(taskId)}" title="${e(tt('ui.move.tooltip'))}" aria-label="${e(tt('ui.move.aria', { task: taskId }))}">${options}</select></div>`;
  };

  const tasksHtml = tasks.length
    ? `<table><thead><tr><th>${e(tt('ui.table.task'))}</th><th>${e(tt('ui.table.title'))}</th><th>${e(tt('ui.table.issue'))}</th><th>${e(tt('ui.table.status'))}</th><th>${e(tt('ui.table.evidence'))}</th><th>${e(tt('ui.table.owner'))}</th></tr></thead><tbody>${tasks
        .map((task) => {
          const link =
            task.issueUrl && isOpenableUrl(task.issueUrl)
              ? `<a href="#" data-url="${e(task.issueUrl)}">#${task.issueNumber ?? 'open'}</a>`
              : `<span class="warn">${e(tt('ui.issue.not-linked'))}</span>`;
          const owner = ownerHtml(task);
          return `<tr><td><span class="tag">${e(task.id)}</span></td><td>${e(task.title)}</td><td>${link}</td><td>${statusCell(task.id)}</td><td>${evidenceCell(task.id)}</td><td>${owner}</td></tr>`;
        })
        .join('')}</tbody></table>
       <div class="actions"><button data-cmd="loadStatus"${status?.loading ? ' disabled' : ''}>${
         e(tt(status?.loading ? 'ui.button.loading' : loaded ? 'ui.button.refresh' : 'ui.button.load'))
       }</button></div>
       <p class="muted small">${e(tt('ui.tasks.note'))}</p>`
    : `<p class="empty">${e(tt('ui.tasks.empty'))}</p>`;

  let boardHtml = '';
  if (loaded) {
    const cards = tasks.flatMap((task) => {
      const entry = placed.get(task.id);
      return entry ? [{ task, issue: entry.issue, placement: entry.placement }] : [];
    });
    const grouped = groupByColumn(cards);
    const off = tasks.filter((task) => !placed.has(task.id));
    boardHtml = `<h2>${e(tt('ui.board.title'))}</h2>
      <div class="board">${KANBAN_COLUMNS.map(
        (name) => `<div class="lane"><h3>${e(column(name))} <span class="muted">${grouped[name].length}</span></h3>${grouped[name]
          .map(
            (c) => `<div class="card"><span class="tag">${e(c.task.id)}</span> ${e(c.task.title)}
              <div class="muted small">${ownerHtml(c.task)}</div>
              ${allGaps(c.task.id).map((g) => `<div class="warn small">${e(g)}</div>`).join('')}</div>`,
          )
          .join('')}</div>`,
      ).join('')}</div>
      ${off.length ? `<p class="muted small">${e(tt('ui.board.not-on-board', { tasks: off.map((task) => task.id) }))}</p>` : ''}`;
  }

  let evidenceHtml = `<p class="muted">${e(tt('ui.evidence.hint-load'))}</p>`;
  if (loaded) {
    const withGaps = tasks
      .map((task) => ({ task, gaps: allGaps(task.id) }))
      .filter((x) => status?.byTask[x.task.id]?.ok && x.gaps.length > 0);
    evidenceHtml = withGaps.length
      ? `<ul class="plain">${withGaps
          .map((x) => `<li><span class="tag">${e(x.task.id)}</span> <span class="warn">${x.gaps.map(e).join('; ')}</span></li>`)
          .join('')}</ul>`
      : `<p class="ok">${e(tt('ui.evidence.none'))}</p>`;
    evidenceHtml += `<p class="muted small">${e(tt('ui.evidence.footnote'))}</p>`;
  }

  const gapsHtml = issues.length
    ? `<ul class="plain">${issues
        .map((i) => `<li class="${i.severity}"><strong>${e(tt(`ui.severity.${i.severity}` as MessageKey))}</strong> ${e(tt(validationKey(i.code), i.args))}</li>`)
        .join('')}</ul>`
    : `<p class="ok">${e(tt('ui.gaps.none'))}</p>`;

  const noteKey = STATUS_NOTE[requirement.status];

  return `<!DOCTYPE html>
<html lang="${locale}">
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
  ${noteKey ? `<p class="muted">${e(tt(noteKey))}</p>` : ''}
  <dl>${metaHtml}</dl>
  <div class="actions">
    <button data-cmd="openSource">${e(tt('ui.button.open-source'))}</button>
    <button data-cmd="openPreview">${e(tt('ui.button.open-preview'))}</button>
  </div>

  <h2>${e(tt('ui.criteria.title', { count: requirement.criteria.length }))}</h2>
  ${criteriaHtml}

  <h2>${e(tt('ui.tasks.title', { count: tasks.length }))}</h2>
  ${tasksHtml}

  ${boardHtml}

  <h2>${e(tt('ui.gaps.title', { count: issues.length }))}</h2>
  ${gapsHtml}

  <h2>${e(tt('ui.evidence.title'))}</h2>
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
