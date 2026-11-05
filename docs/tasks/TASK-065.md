---
id: TASK-065
type: task
title: Decide the task section of the process file and state the independence principle
requirement: REQ-010
issue: https://github.com/blcktgr73/Weaver/issues/163
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-002, AC-006, AC-007]
assignee: claude-code
---

# TASK-065 Decide the task section of the process file and state the independence principle

Tracked in [Issue #163](https://github.com/blcktgr73/Weaver/issues/163). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Write a decision record that fixes the shape of the `task` section (fields, `source`, mapping, `require-file`) and how a violation is reported. Add the independence principle to `AGENTS.md`. No code reads the section yet.
