---
id: TASK-013
type: task
title: Assign a task owner from the Requirement view
requirement: REQ-002
issue: https://github.com/blcktgr73/Weaver/issues/36
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-013 Assign a task owner from the Requirement view

Tracked in [Issue #36](https://github.com/blcktgr73/Weaver/issues/36). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Choose a human or an agent in the Requirement view; write the owner to the task file and the GitHub Issue assignee together, after an explicit confirmation.

## Progress

- The Requirement view has an "Owner…" link on each task that has a task file. It offers the roster of the personal configuration (or somebody typed by hand), shows every change in a confirmation, then writes the task file's front matter and, for a human with a GitHub login, the Issue assignee. An agent has no account, so the Issue stays as it is. If the Issue cannot be set, the file is already written and the message says so.
- The page was rendered once by hand; the dialogs were not driven in a development host (the editor code has no automated tests).

