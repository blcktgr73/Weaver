import {
  formatNotice,
  KANBAN_COLUMNS,
  KanbanPlacement,
  Lane,
  Locale,
  MessageArgs,
  MessageKey,
  Mismatch,
  Notice,
  RequirementLink,
  t,
  ValidationIssue,
  validationKey,
} from '@palab/weaver-markdown';
import { escapeHtml } from './requirementHtml';

/** A card of the Overview: a Project item, with the requirement it belongs to when the files say so. */
export interface OverviewCard {
  repository: string;
  number: number;
  title: string;
  url: string;
  assignees: string[];
  taskId?: string;
  placement: KanbanPlacement;
  requirement?: RequirementLink;
  /** Why the card needs a second look: idle, no pull request, or waiting for a decision. */
  stale: Notice[];
  /** The card a requirement view or task file asked to see. */
  focus?: boolean;
  /** Built from the repository files because GitHub could not be read; it has no menu. */
  fromFiles?: boolean;
}

export type OverviewState =
  | { kind: 'no-registry' }
  | { kind: 'registry-invalid'; issues: ValidationIssue[] }
  | { kind: 'sign-in' }
  | { kind: 'loading' }
  | { kind: 'error'; error: Notice; /** The board built from the files, shown under the notice. */ offline?: { lanes: Lane<OverviewCard>[]; collapsed: string[] } }
  | {
      kind: 'ready';
      projectTitle: string;
      lanes: Lane<OverviewCard>[];
      skipped: number;
      /** Repositories the user turned off, and lanes folded to their header. Kept on this computer only. */
      hidden: string[];
      collapsed: string[];
      /** Where files, Issues, and the Project disagree. Reported only. */
      mismatches: Mismatch[];
      /** Checks that could not run, such as unreadable pull requests. */
      skippedChecks: Notice[];
      /** True while some cards are highlighted, so the header can offer to clear them. */
      focusActive: boolean;
    };

const TASK_PREFIX = /^\[TASK-\d{3,}\]\s*/;

export function renderOverviewHtml(state: OverviewState, nonce: string, cspSource: string, locale: Locale): string {
  const e = escapeHtml;
  const tt = (key: MessageKey, args?: MessageArgs): string => t(key, locale, args);

  const button = (cmd: string, key: MessageKey) => `<button data-cmd="${cmd}">${e(tt(key))}</button>`;

  const cardHtml = (card: OverviewCard): string => {
    const gaps = card.placement.gaps.map((gap) => `<div class="warn small">⚠ ${e(formatNotice(gap, locale))}</div>`).join('');
    const requirement = card.requirement
      ? `<button class="req" data-req="${e(card.requirement.id)}" title="${e(tt('ui.overview.open-requirement', { id: card.requirement.id, title: card.requirement.title }))}">${e(card.requirement.id)}</button>`
      : '';
    const stale = card.stale.length
      ? `<div class="stale">${card.stale.map((notice) => `<span class="stale-chip ${notice.code.slice('stale.'.length)}">${e(formatNotice(notice, locale))}</span>`).join('')}</div>`
      : '';
    const assignees = card.assignees.length ? `<div class="muted small">@${e(card.assignees.join(', @'))}</div>` : '';
    const title = e(card.title.replace(TASK_PREFIX, ''));
    const titleHtml = card.requirement
      ? `<a class="title" href="#" data-open="${e(card.url || `task:${card.requirement.id}/${card.requirement.taskId}`)}" title="${e(tt('ui.overview.open-task', { id: card.requirement.id, task: card.requirement.taskId }))}">${title}</a>`
      : `<a class="title" href="#" data-url="${e(card.url)}" title="${e(tt('ui.overview.open-issue', { number: card.number }))}">${title}</a>`;
    return `<div class="card${card.placement.gaps.length ? ' has-gap' : ''}${card.stale.length ? ' is-stale' : ''}${card.focus ? ' focus' : ''}"${card.url && !card.fromFiles ? ` data-card="${e(card.url)}"` : ''}>
        <div class="top">${card.url ? `<a class="tag" href="#" data-url="${e(card.url)}" title="${e(tt('ui.overview.open-issue', { number: card.number }))}">#${card.number}</a>` : ''}${card.taskId ? ` <span class="muted small">${e(card.taskId)}</span>` : ''} ${requirement}</div>
        <div>${titleHtml}</div>${gaps}${stale}${assignees}
      </div>`;
  };

  const laneHtml = (lane: Lane<OverviewCard>, folded: boolean, index: number, count: number): string => `<section class="lane">
      <h2><button class="fold" data-fold="${e(lane.repository)}" aria-expanded="${!folded}" title="${e(tt(folded ? 'ui.overview.unfold' : 'ui.overview.fold', { title: lane.title }))}">${folded ? '\u25b8' : '\u25be'}</button>${e(lane.title)} <span class="muted small">${e(lane.repository)}</span>
        <span class="lane-move">${index > 0 ? `<button class="mv" data-move-lane="${e(lane.repository)}" data-delta="-1" title="${e(tt('ui.overview.move-up', { title: lane.title }))}">\u25b2</button>` : ''}${index < count - 1 ? `<button class="mv" data-move-lane="${e(lane.repository)}" data-delta="1" title="${e(tt('ui.overview.move-down', { title: lane.title }))}">\u25bc</button>` : ''}</span>
        <span class="badge">${e(tt('ui.overview.cards', { count: lane.total }))}</span>${lane.blocked ? `<span class="badge blocked">${e(tt('ui.overview.blocked', { count: lane.blocked }))}</span>` : ''}</h2>
      ${folded ? '' : lane.total === 0 ? `<p class="muted small">${e(tt('ui.overview.no-cards'))}</p>` : `<div class="cols">${KANBAN_COLUMNS.map((column) => `<div class="col">${lane.columns[column].map(cardHtml).join('')}</div>`).join('')}</div>`}
    </section>`;

  const boardOf = (lanes: Lane<OverviewCard>[], collapsed: Set<string>): string =>
    `<div class="colhead cols">${KANBAN_COLUMNS.map((column) => `<div>${e(tt(`column.${column}` as MessageKey))}</div>`).join('')}</div>
      ${lanes.map((lane, index) => laneHtml(lane, collapsed.has(lane.repository), index, lanes.length)).join('')}`;

  let body: string;
  let filter = '';
  switch (state.kind) {
    case 'no-registry':
      body = `<p class="muted">${e(tt('ui.overview.no-registry'))}</p>`;
      break;
    case 'registry-invalid':
      body = `<p>${e(tt('ui.overview.registry-problems'))}</p><ul class="plain">${state.issues
        .map((issue) => `<li class="${issue.severity}"><strong>${e(tt(`ui.severity.${issue.severity}` as MessageKey))}</strong> ${e(t(validationKey(issue.code), locale, issue.args))}</li>`)
        .join('')}</ul>`;
      break;
    case 'sign-in':
      body = `<p class="muted">${e(tt('ui.overview.sign-in-note'))}</p><div class="actions">${button('signIn', 'ui.overview.sign-in')}</div>`;
      break;
    case 'loading':
      body = `<p class="muted">${e(tt('ui.overview.loading'))}</p>`;
      break;
    case 'error':
      body = `<p class="warn">${e(formatNotice(state.error, locale))}</p><div class="actions">${button('signIn', 'ui.overview.sign-in')}${button('refresh', 'ui.overview.refresh')}</div>`
        + (state.offline ? `<p class="warn small">${e(tt('ui.overview.offline-note'))}</p>${boardOf(state.offline.lanes, new Set(state.offline.collapsed))}` : '');
      break;
    case 'ready': {
      const hidden = new Set(state.hidden);
      const collapsed = new Set(state.collapsed);
      const shown = state.lanes.filter((lane) => !hidden.has(lane.repository));
      const chips = state.lanes
        .map((lane) => {
          const on = !hidden.has(lane.repository);
          return `<button class="chip ${on ? 'on' : 'off'}" data-toggle="${e(lane.repository)}" aria-pressed="${on}" title="${e(tt('ui.overview.toggle-project', { title: lane.title }))}">${e(lane.title)} <span class="n">${lane.total}</span></button>`;
        })
        .join('');
      filter = `<div class="filter"><span class="muted">${e(tt('ui.overview.projects'))}</span>${chips}${hidden.size ? button('showAll', 'ui.overview.show-all') : ''}</div>`;
      const mismatchHtml = state.mismatches.length
        ? `<details class="mismatches" open><summary>\u26a0 ${e(tt('ui.overview.mismatches', { count: state.mismatches.length }))}</summary>
        <p class="muted small">${e(tt('ui.overview.mismatches-note'))}</p>
        <ul class="plain">${state.mismatches
          .map(
            (m) =>
              `<li>${e(t(`mismatch.${m.kind}` as MessageKey, locale, m.args))}${m.path ? ` <a href="#" data-file="${e(m.path)}">${e(tt('ui.overview.open-file', { path: m.path }))}</a>` : ''}${m.url ? ` <a href="#" data-url="${e(m.url)}">\u2197</a>` : ''}</li>`,
          )
          .join('')}</ul></details>`
        : `<p class="muted small">${e(tt('ui.overview.mismatches-none'))}</p>`;
      const skippedChecks = state.skippedChecks.length
        ? `<p class="muted small">${e(tt('ui.overview.mismatches-skipped', { reasons: state.skippedChecks.map((n) => formatNotice(n, locale)).join(' ') }))}</p>`
        : '';
      body = mismatchHtml + skippedChecks + (shown.length
        ? `${boardOf(shown, collapsed)}
      ${state.skipped ? `<p class="muted small">${e(tt('ui.overview.skipped', { count: state.skipped }))}</p>` : ''}`
        : `<p class="muted">${e(tt('ui.overview.all-hidden'))}</p>`);
      break;
    }
  }

  const projectLine = state.kind === 'ready' ? `<span class="muted">${e(tt('ui.overview.project', { title: state.projectTitle }))}</span>` : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(tt('ui.overview.title'))}</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 24px; line-height: 1.45; margin: 0; height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 1.5em; margin: 16px 0 8px; }
  h2 { font-size: 1.05em; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
  /* The board scrolls inside the window, so both scrollbars stay in view. */
  .scroll { flex: 1; min-height: 0; overflow: auto; padding-bottom: 24px; }
  .scroll::-webkit-scrollbar { width: 12px; height: 12px; }
  .scroll::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); }
  .scroll::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
  .scroll::-webkit-scrollbar-corner { background: transparent; }
  details.mismatches { margin: 4px 0 10px; }
  details.mismatches summary { cursor: pointer; color: var(--vscode-editorWarning-foreground); font-weight: 600; }
  details.mismatches li { padding: 2px 0; }
  .filter { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 4px 0 8px; }
  button.chip { border-radius: 12px; padding: 2px 10px; border: 1px solid var(--vscode-panel-border); }
  button.chip.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.chip.off { background: transparent; color: var(--vscode-descriptionForeground); text-decoration: line-through; }
  button.chip .n { opacity: 0.8; font-size: 0.85em; }
  .lane-move { margin-left: 8px; }
  button.mv { background: transparent; color: var(--vscode-descriptionForeground); padding: 0 4px; font-size: 0.8em; }
  button.mv:hover { color: var(--vscode-foreground); }
  button.fold { background: transparent; color: var(--vscode-foreground); padding: 0 6px 0 0; font-size: 1em; }
  .cols { display: grid; grid-template-columns: repeat(6, minmax(170px, 1fr)); gap: 8px; min-width: 1040px; }
  .colhead { position: sticky; top: 0; z-index: 2; background: var(--vscode-editor-background); padding: 6px 0; font-weight: 600; color: var(--vscode-descriptionForeground); }
  .col { min-height: 24px; }
  .card { overflow-wrap: anywhere; border: 1px solid var(--vscode-panel-border); border-radius: 3px; padding: 6px 8px; margin-bottom: 6px; background: var(--vscode-editor-background); }
  .card.focus { outline: 2px solid var(--vscode-focusBorder, var(--vscode-textLink-foreground)); outline-offset: 1px; }
  .card.has-gap { border-color: var(--vscode-editorWarning-foreground); }
  .stale { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .stale-chip { font-size: 0.8em; padding: 0 7px; border-radius: 10px; border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); }
  .stale-chip.idle { border-color: var(--vscode-editorWarning-foreground); color: var(--vscode-editorWarning-foreground); }
  .stale-chip.needs-decision { border-color: var(--vscode-editorInfo-foreground, var(--vscode-textLink-foreground)); color: var(--vscode-editorInfo-foreground, var(--vscode-textLink-foreground)); }
  .stale-chip.no-evidence { border-color: var(--vscode-editorError-foreground); color: var(--vscode-editorError-foreground); }
  .top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  a.title { display: inline-block; margin-top: 2px; color: var(--vscode-foreground); text-decoration: none; }
  a.title:hover { text-decoration: underline; color: var(--vscode-textLink-foreground); }
  .tag { white-space: nowrap; font-family: var(--vscode-editor-font-family); font-size: 0.9em; color: var(--vscode-textLink-foreground); }
  .badge { margin-left: 8px; padding: 1px 8px; border-radius: 10px; font-size: 0.8em; font-weight: normal; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .badge.blocked { background: var(--vscode-inputValidation-warningBackground, var(--vscode-badge-background)); color: var(--vscode-editorWarning-foreground); }
  .muted { color: var(--vscode-descriptionForeground); }
  .warn { color: var(--vscode-editorWarning-foreground); }
  li.error strong { color: var(--vscode-editorError-foreground); }
  li.warning strong { color: var(--vscode-editorWarning-foreground); }
  ul.plain { padding-left: 0; list-style: none; }
  .small { font-size: 0.85em; }
  .actions { margin: 12px 0; display: flex; gap: 8px; }
  button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 0; padding: 4px 10px; border-radius: 2px; cursor: pointer; }
  button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.req { padding: 0 7px; border-radius: 10px; font-size: 0.8em; font-family: var(--vscode-editor-font-family); }
  a { color: var(--vscode-textLink-foreground); }
</style>
</head>
<body>
  <header><h1>${e(tt('ui.overview.title'))}</h1>${projectLine}${state.kind === 'ready' ? button('refresh', 'ui.overview.refresh') + button('cloneMissing', 'ui.overview.clone') + (state.focusActive ? button('clearFocus', 'ui.overview.clear-focus') : '') : ''}</header>
  ${filter}
  <div class="scroll">${body}</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.querySelector('.card.focus')?.scrollIntoView({ block: 'center', inline: 'center' });
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-cmd],[data-url],[data-open],[data-req],[data-toggle],[data-fold],[data-file],[data-move-lane]');
    if (!target) return;
    event.preventDefault();
    if (target.dataset.cmd) vscode.postMessage({ type: target.dataset.cmd });
    if (target.dataset.url) vscode.postMessage({ type: 'openUrl', url: target.dataset.url });
    if (target.dataset.open) vscode.postMessage({ type: 'openCard', url: target.dataset.open });
    if (target.dataset.file) vscode.postMessage({ type: 'openFile', path: target.dataset.file });
    if (target.dataset.req) vscode.postMessage({ type: 'openRequirement', id: target.dataset.req });
    if (target.dataset.toggle) vscode.postMessage({ type: 'toggleLane', id: target.dataset.toggle });
    if (target.dataset.fold) vscode.postMessage({ type: 'foldLane', id: target.dataset.fold });
    if (target.dataset.moveLane) vscode.postMessage({ type: 'moveLane', id: target.dataset.moveLane, delta: Number(target.dataset.delta) });
  });
  document.addEventListener('contextmenu', (event) => {
    const card = event.target.closest('[data-card]');
    if (!card) return;
    event.preventDefault();
    vscode.postMessage({ type: 'cardMenu', url: card.dataset.card });
  });
</script>
</body>
</html>`;
}
