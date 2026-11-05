---
id: TASK-067
type: task
title: Reconcile declared fields and allow light cards
requirement: REQ-010
issue: https://github.com/blcktgr73/Weaver/issues/165
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-004, AC-005]
assignee: claude-code
---

# TASK-067 Reconcile declared fields and allow light cards

Tracked in [Issue #165](https://github.com/blcktgr73/Weaver/issues/165). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

`reconcile` compares each declared field with its board or label projection and reports a difference as a gap. A task without a file is not a gap when `require-file` is off.

## What it does

- Reports four of the five gaps of [DEC-016](../decisions/DEC-016-task-contract-in-process-file.md) item 9 for a task file: `task-field-missing`, `task-field-value`, `task-field-in-file`, and `task-field-differs`. The last compares a `file` field with its label, and with its Project field when `reconcile` has read it. They are only reported, never fixed: the file wins, and the message says what the board shows.
- A card with no file is not a mismatch when the process says `require-file: false`.
- The editor accepts the fields a process declares in the task files of its repository, so they are no longer "unknown field" warnings.
- Without a `task` section nothing changes.

`task-section-missing` (a heading of `body.sections` is absent) is not done: a parsed task does not keep its body. It stays open under this task.
