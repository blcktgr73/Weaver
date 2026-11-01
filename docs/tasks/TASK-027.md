---
id: TASK-027
type: task
title: Show which parts of the process are configured and which are defaults
requirement: REQ-005
issue: https://github.com/blcktgr73/Weaver/issues/57
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-004]
assignee: claude-code
---

# TASK-027 Show which parts of the process are configured and which are defaults

Tracked in [Issue #57](https://github.com/blcktgr73/Weaver/issues/57). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

The Requirement view lists each process setting with its source (configuration file or default).

## Progress

- The Requirement view has a "Process" section. For each repository the requirement's tasks live in, it says whether the repository has a `.weaver/process.yaml` (or none, or was not asked yet) and lists the columns, evidence, and idle-days settings with the value in use and whether it comes from the repository file or is the default. Idle days left to the default show the `weaver.staleDays` setting, which is what the Overview uses.
- The page was rendered once by hand to check the text in Korean; the editor code has no automated tests and was not driven in a window against a real repository with the file.

