---
id: TASK-042
type: task
title: Show the last read board when GitHub is unreachable
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/92
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-008, AC-013]
assignee: claude-code
---

# TASK-042 Show the last read board when GitHub is unreachable

Tracked in [Issue #92](https://github.com/blcktgr73/Weaver/issues/92). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-011](../decisions/DEC-011-offline-board-from-last-read.md).

Keep the last successful read of the Project on this computer and show it, with its age, when GitHub cannot be read.

## Done when

- A successful read is kept on this computer, and a failed read shows it with a notice that says how long ago it was read.
- A kept read of another Project, or a damaged one, is ignored and the board from files is shown.
- The notice and the age are in the English and Korean catalog.
