---
id: TASK-066
type: task
title: Read the task section and fill it in on task create
requirement: REQ-010
issue: https://github.com/blcktgr73/Weaver/issues/164
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-003, AC-006]
assignee: claude-code
---

# TASK-066 Read the task section and fill it in on task create

Tracked in [Issue #164](https://github.com/blcktgr73/Weaver/issues/164). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Read and validate the `task` section, keeping today's behavior when it is absent. `weaver task create` fills the declared fields and shows them in the plan before the person confirms.
