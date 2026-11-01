---
id: TASK-051
type: task
title: Keep a requirement tidy when task create adds the first task
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/113
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-002]
assignee: claude-code
---

# TASK-051 Keep a requirement tidy when task create adds the first task

Tracked in [Issue #113](https://github.com/blcktgr73/Weaver/issues/113). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

When `weaver task create` adds the first task to a requirement whose `## Tasks` section holds only a placeholder sentence (for example "Tasks are not created yet. ..."), the sentence is left behind next to the new list. Remove the known placeholder when the list is started. Found by a dry run against REQ-008.

## Done when

- The placeholder sentence "Tasks are not created yet. ..." is removed when the first task line is added, and other text in the section is kept.
- A requirement that already has a list is changed only by the added line.
- Tests cover both cases and the line ending style of the file.
