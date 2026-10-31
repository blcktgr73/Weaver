---
id: TASK-039
type: task
title: Reorder, collapse, hide, and filter lanes
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/73
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-004]
assignee: claude-code
---

# TASK-039 Reorder, collapse, hide, and filter lanes

Tracked in [Issue #73](https://github.com/blcktgr73/Weaver/issues/73). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Let a user reorder, collapse, hide, and filter the repository lanes of the Overview Kanban. The choices are kept on the user's computer, not in the repository. Grouping by requirement or by owner is a later extension.

## Done when

- Lanes can be reordered, collapsed, hidden, and filtered by repository.
- A collapsed lane still shows its card count and its blocked-card count.
- The choices survive a restart and are never written to the repository.
- Messages are in the catalog in English and Korean.
