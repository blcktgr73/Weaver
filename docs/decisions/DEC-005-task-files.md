# DEC-005: Task files carry ownership, criteria, and blockers

- Status: accepted
- Date: 2026-10-30
- Related: `REQ-001`, `TASK-008`, `TASK-009`, `TASK-011`, [DEC-003](./DEC-003-board-status-mapping.md)

## Context

A requirement lists its tasks as Markdown list items (ID, title, Issue link). That is enough to show a board, but not to say who owns a task, which acceptance criteria it satisfies, or what blocks it. AGENTS.md says task definitions and ownership live in repository artifacts, and the artifact schema already defines `type: task` files with `assignee_type`, `assignee`, and `blockers`. The Requirement view showed owners only from the GitHub Issue, which is a projection.

## Decision

1. A task may have a **task file** under `docs/tasks/TASK-###.md` (frontmatter plus free text). The requirement's task list stays the index: order, title, and Issue link.
2. The task file is the source for:
   - `assignee_type` (`human` or `agent`) and `assignee`;
   - `criteria`: the acceptance criteria IDs the task satisfies, for example `[AC-001, AC-003]`;
   - `blockers` and the `needs-human-decision` status.
3. **`status` becomes optional in a task file when it has an `issue` link.** The Kanban column comes from the Issue ([DEC-003](./DEC-003-board-status-mapping.md)); a second hand-kept status would go stale. Without an Issue, `status` stays required.
4. The view merges the list and the task files by task ID. A task file whose ID is not in the requirement's list is a validation warning.
5. The Issue assignee is shown only as a hint when the task file has no owner.

## Consequences

- Tasks keep working without a task file; they show a gap where the owner or criteria are missing.
- Owner changes are repository changes: reviewed in a pull request, with history.
- A later change can write `assignee` and `criteria` from the view; for now they are edited in Markdown.
