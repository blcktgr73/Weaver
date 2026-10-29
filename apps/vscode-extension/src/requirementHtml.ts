import type { RequirementArtifact, ValidationIssue } from '@palab/weaver-markdown';

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

  const tasksHtml = requirement.tasks.length
    ? `<table><thead><tr><th>Task</th><th>Title</th><th>Issue</th></tr></thead><tbody>${requirement.tasks
        .map((t) => {
          const link =
            t.issueUrl && isOpenableUrl(t.issueUrl)
              ? `<a href="#" data-url="${e(t.issueUrl)}">#${t.issueNumber ?? 'open'}</a>`
              : '<span class="warn">not linked</span>';
          return `<tr><td><span class="tag">${e(t.id)}</span></td><td>${e(t.title)}</td><td>${link}</td></tr>`;
        })
        .join('')}</tbody></table>`
    : '<p class="empty">No tasks found under “## Tasks”.</p>';

  const gapsHtml = issues.length
    ? `<ul class="plain">${issues
        .map((i) => `<li class="${i.severity}"><strong>${i.severity}</strong> ${e(i.message)}</li>`)
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
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 24px 48px; line-height: 1.5; max-width: 880px; }
  h1 { font-size: 1.6em; margin: 4px 0 12px; }
  h2 { font-size: 1.1em; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
  .idline { margin-top: 20px; font-weight: 600; color: var(--vscode-descriptionForeground); }
  .badge { margin-left: 8px; padding: 1px 8px; border-radius: 10px; font-size: 0.85em; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .tag { font-family: var(--vscode-editor-font-family); font-size: 0.9em; color: var(--vscode-textLink-foreground); }
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

  <h2>Gaps and checks (${issues.length})</h2>
  ${gapsHtml}

  <h2>Evidence</h2>
  <p class="muted">Branch, pull request, and test evidence is not linked yet. It arrives with TASK-004.</p>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
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
