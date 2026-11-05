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
