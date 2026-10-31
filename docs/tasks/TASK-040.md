---
id: TASK-040
type: task
title: Replace the requirement board with a stage summary
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/81
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-010]
assignee: claude-code
---

# TASK-040 Replace the requirement board with a stage summary

Tracked in [Issue #81](https://github.com/blcktgr73/Weaver/issues/81). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Remove the second Kanban board from the requirement view. Show one line of stage counts (for example Backlog 3, In progress 1, Verified 2) next to the task table, whose Status column keeps moving a card. The Overview is the single board.

## Done when

- The requirement view has no board; a line of stage counts shows where its tasks stand.
- Moving a task from the Status column still works and asks first.
- Tasks whose Issue is not read yet are counted apart, not hidden.
- Messages are in the catalog in English and Korean.
