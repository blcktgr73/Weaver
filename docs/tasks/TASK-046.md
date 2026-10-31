---
id: TASK-046
type: task
title: Create a task with its Issue and Project card in one operation
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/97
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-002, AC-004]
assignee: claude-code
---

# TASK-046 Create a task with its Issue and Project card in one operation

Tracked in [Issue #97](https://github.com/blcktgr73/Weaver/issues/97). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Add `weaver task create` that, from a title, a requirement, and criteria, writes the next `TASK-###` file, creates the Issue with the standard labels, adds it to the Project, and links the Issue from the task file and the requirement. The file change is offered as a pull request, never committed to the default branch.

## Done when

- The plan lists the task file, the Issue, the Project card, and the requirement change before anything runs.
- The next task number is taken from the files and the open pull requests so two runs do not collide.
- The file change goes to a new branch with a pull request; the default branch is untouched.
- If a later step fails, the result says exactly what was already created.
- Tests cover numbering, the plan, and a partial failure.
