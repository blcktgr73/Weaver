---
id: TASK-037
type: task
title: Show a read-only board when GitHub is unreachable
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/69
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-007]
assignee: claude-code
---

# TASK-037 Show a read-only board when GitHub is unreachable

Tracked in [Issue #69](https://github.com/blcktgr73/Weaver/issues/69). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Build the board from repository files only when GitHub cannot be reached, and say that the state is not current.

## Done when

- The fallback board appears without a network.
- A visible notice says the state may be out of date.
