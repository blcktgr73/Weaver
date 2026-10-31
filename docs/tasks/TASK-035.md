---
id: TASK-035
type: task
title: List mismatches between files, Issues, and the Project
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/67
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-007]
assignee: claude-code
---

# TASK-035 List mismatches between files, Issues, and the Project

Tracked in [Issue #67](https://github.com/blcktgr73/Weaver/issues/67). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Find task files without an Issue, Project cards without a task file, broken Issue links, merged pull requests not linked to their task, and board Status that disagrees with the label. Report only; change nothing.

## Done when

- Each of the five kinds is detected by a pure function with tests.
- The Overview lists them with the card or file involved.
