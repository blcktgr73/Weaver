---
id: TASK-075
type: task
title: Add and edit contributors from the editor
requirement: REQ-011
issue: https://github.com/ebrAIn-Lab-3B/Weaver/issues/178
repository: ebrAIn-Lab-3B/Weaver
assignee_type: agent
criteria: [AC-008]
assignee: claude-code
---

# TASK-075 Add and edit contributors from the editor

Tracked in [Issue #178](https://github.com/ebrAIn-Lab-3B/Weaver/issues/178). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Let a person add, change, and remove a contributor from the editor without writing YAML by hand, after seeing the change, and keeping the comments of the file, as choosing repositories already does. Weaver never writes to a referenced repository ([DEC-017](../decisions/DEC-017-shared-roster-by-reference.md)), so the edit goes to the personal roster, or to a roster file in a local clone that the person then commits and opens a pull request for.

Starts after `TASK-074` and `TASK-070`. The form of the editing view is decided in this task.
