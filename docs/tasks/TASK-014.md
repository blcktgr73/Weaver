---
id: TASK-014
type: task
title: Define the contributor roster and pick owners from it
requirement: REQ-002
issue: https://github.com/blcktgr73/Weaver/issues/37
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-002, AC-003]
assignee: claude-code
---

# TASK-014 Define the contributor roster and pick owners from it

Tracked in [Issue #37](https://github.com/blcktgr73/Weaver/issues/37). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Define where the roster lives and its shape (kind, tool or model, how reached), read it in the workspace scan, and report an owner that is not in the roster as a gap.

## Progress

- The roster is the `roster` of the personal configuration (DEC-014), read when the Requirement view loads. An owner, reviewer, or approver who is not in it is shown as a gap on the task, and an approver who is an agent as well. With no roster there are no gaps.
- The workspace scan reads the roster too: an owner, reviewer, or approver of a task file who is not in it, and an approver who is an agent, are warnings in the Problems panel on that task file. With no roster none is raised. "Agent work Verified without a human approval" needs the card's column, so it is shown in the Requirement view only.
- The Problems panel was not looked at by hand; the code has no automated tests.

