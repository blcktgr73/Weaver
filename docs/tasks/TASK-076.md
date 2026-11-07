---
id: TASK-076
type: task
title: Skip agent worktrees and sample folders when reading the workspace
requirement: REQ-006
issue: https://github.com/ebrAIn-Lab-3B/Weaver/issues/185
repository: ebrAIn-Lab-3B/Weaver
assignee_type: agent
criteria: [AC-017]
assignee: claude-code
---

# TASK-076 Skip agent worktrees and sample folders when reading the workspace

Tracked in [Issue #185](https://github.com/ebrAIn-Lab-3B/Weaver/issues/185). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Friction found on 2026-11-06: the Problems panel showed 463 `duplicate-id` errors. An agent worktree under `.claude/worktrees/` is a full copy of the repository, so the extension read every requirement and task once per copy and reported each ID as defined twice or more. With the repository root open, the sample documents under `examples/` also raised warnings, and the extension package used `setTimeout` without declaring `@types/node`.

- The workspace scan and the file watcher of the extension skip `.claude/worktrees` and `examples`.
- The CLI skips `.claude/worktrees` as well (it already skipped `examples`), and keeps the other documents under `.claude/`.
- The extension package declares `@types/node` itself instead of borrowing the one hoisted from other packages.
