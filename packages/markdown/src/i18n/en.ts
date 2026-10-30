/** A message is a template with {name} placeholders, or singular/plural forms chosen by `args.count`. */
export type Message = string | { one: string; other: string };

/** English is the source catalog. Every other locale must define every key here. */
export const en = {
  // Frontmatter and workspace validation (see docs/product/artifact-schema-v0.1.md)
  'validation.frontmatter-invalid': 'Frontmatter is not valid YAML: {detail}',
  'validation.missing-field': 'Required field "{field}" is missing or empty.',
  'validation.invalid-id': '"{id}" does not match the {pattern} pattern.',
  'validation.invalid-status': 'Status "{status}" is not allowed. Use one of: {allowed}.',
  'validation.invalid-repository': 'Repository "{repository}" must look like owner/name.',
  'validation.unknown-field': 'Unknown field "{field}" is kept but not interpreted.',
  'validation.story-ids-not-list': '"story_ids" must be a list.',
  'validation.invalid-story-id': 'Story ID "{id}" does not match US-###.',
  'validation.no-acceptance-criteria': 'No items under "## Acceptance criteria".',
  'validation.no-tasks': 'No items under "## Tasks".',
  'validation.malformed-task-item': 'Task list item does not start with a TASK ID: "{item}"',
  'validation.task-without-issue': '{task} has no Issue link.',
  'validation.invalid-requirement-ref': 'Requirement reference "{requirement}" does not match REQ-###.',
  'validation.invalid-assignee-type': 'assignee_type "{value}" must be human or agent.',
  'validation.invalid-blockers': '"blockers" must be a list.',
  'validation.duplicate-id': '{id} is already defined in {path}.',
  'validation.unknown-requirement': '{task} refers to {requirement}, which does not exist.',
  'validation.task-listed-twice': '{task} is already listed under {owner}.',

  // Why a Kanban card needs attention
  'gap.multiple-status-labels': 'multiple status labels: {columns}',
  'gap.no-status-label': 'no status label',
  'gap.closed-without-verified': 'closed without status:verified (verification gap)',
  'gap.open-but-verified': 'open but labeled status:verified',

  // Evidence gaps
  'gap.evidence-not-loaded': 'evidence not loaded',
  'gap.no-linked-pr': 'no linked pull request',
  'gap.no-merged-pr': 'no merged pull request',
  'gap.checks-failing': { one: 'PR {prs} has failing checks', other: 'PRs {prs} have failing checks' },
  'gap.checks-pending': { one: 'PR {prs} checks are still running', other: 'PRs {prs} checks are still running' },
  'gap.checks-none': { one: 'PR {prs} has no check results', other: 'PRs {prs} have no check results' },

  // What a column move will change on GitHub
  'move.remove-labels': { one: 'Remove label: {labels}', other: 'Remove labels: {labels}' },
  'move.add-label': 'Add label: {label}',
  'move.close-issue': 'Close the Issue',
  'move.reopen-issue': 'Reopen the Issue',
  'move.set-board-status': 'Set board Status: {status}',

  // Pull request summary line
  'pull.summary': 'PR #{number} {state} · {checks} · {link}',
  'pull.state.open': 'open',
  'pull.state.closed': 'closed',
  'pull.state.merged': 'merged',
  'pull.checks.passing': 'checks passing',
  'pull.checks.failing': 'checks failing',
  'pull.checks.pending': 'checks pending',
  'pull.checks.none': 'no checks',
  'pull.link.closes': 'closes Issue',
  'pull.link.mentions': 'mentions Issue',

  // Kanban column names (labels and board values stay in English)
  'column.Backlog': 'Backlog',
  'column.Ready': 'Ready',
  'column.In progress': 'In progress',
  'column.Blocked': 'Blocked',
  'column.Review': 'Review',
  'column.Verified': 'Verified',
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
