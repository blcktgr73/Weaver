# DEC-001: Unify the status vocabulary

- Status: accepted
- Date: 2026-10-28
- Related: `REQ-001`, `TASK-001`

## Context

Two documents described statuses, and they disagreed.

- `requirements-v0.1.md` wrote `draft → … → accepted` with underscores (`in_progress`).
- `github-issues-integration.md` wrote `Backlog … Verified` as hyphenated labels (`status:in-progress`).
- The frontmatter of `REQ-001` uses hyphens (`in-progress`).

With no mapping between the two, the same task could read as a different status in each document.

## Decision

1. Every status value is **lowercase and hyphenated** (`in-progress`, `needs-human-decision`). Underscores are not used.
2. The status model has two layers.
   - **Lifecycle status** (Markdown frontmatter): how far a requirement or task has progressed.
   - **Kanban column** (GitHub label): a projection that folds the lifecycle status into six columns.
3. The mapping table in [Product Requirements v0.1](../product/requirements-v0.1.md#status-mapping) is the single reference. Other documents link to it.

## Consequences

- The schema validator for `TASK-001` accepts only the hyphenated form.
- A status with no Kanban column (`cancelled`) is not shown on the board.
