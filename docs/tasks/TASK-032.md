---
id: TASK-032
type: task
title: Show the Overview Kanban
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/64
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-003, AC-008, AC-009]
assignee: claude-code
---

# TASK-032 Show the Overview Kanban

Tracked in [Issue #64](https://github.com/blcktgr73/Weaver/issues/64). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

When a registry is present, open Weaver on a read-only board that shows cards of all registered repositories with their repository. A repository does not need to be open as a VS Code folder.

## Done when

- The board opens first when a registry exists and does not appear otherwise.
- Each card shows its repository.
- Messages are in the catalog in English and Korean.
