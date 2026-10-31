---
id: TASK-034
type: task
title: Set a fabric root folder and clone the missing repositories
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/66
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-002]
assignee: claude-code
---

# TASK-034 Set a fabric root folder and clone the missing repositories

Tracked in [Issue #66](https://github.com/blcktgr73/Weaver/issues/66). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Let each user set a local fabric root that is not shared, clone every registered repository that is missing under it, and open the folder in VS Code.

## Done when

- Existing clones are skipped and never overwritten.
- The root path is stored locally and never in the repository.
- A clone failure for one repository does not stop the others and is reported.
