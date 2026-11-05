---
id: TASK-070
type: task
title: Read the roster and the profile from a reference with a cache
requirement: REQ-011
issue: https://github.com/blcktgr73/Weaver/issues/168
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-002, AC-003, AC-006]
assignee: claude-code
---

# TASK-070 Read the roster and the profile from a reference with a cache

Tracked in [Issue #168](https://github.com/blcktgr73/Weaver/issues/168). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Implement reading by reference, the local cache with its age shown, offline use, and the rule that instance settings are ignored. Writing to the referenced repository is not possible.

The reader must read `examples/roster.example.yaml` ([TASK-074](TASK-074.md)) with no issue; add that as a test.

## Result

- The roster reader reads `roles` and `reach` as `{type, value}` entries (a plain string reads as a text entry), keeps a field outside the schema out of use with a warning, and reads `roster.from` from `.weaver/process.yaml` or the personal configuration. The process file wins.
- The shared roster is read through GitHub with a conditional request, kept with its ETag and the time of the last confirmation on the person's computer, drawn from that copy at once, and used offline. The Overview shows where it comes from and how old the copy is. The personal roster is laid over it ([DEC-017](../decisions/DEC-017-shared-roster-by-reference.md) item 6). A missing, unreadable, or partly wrong file gives warnings, never errors.
- Not done: the `task.from` reference of the process profile. It waits for `TASK-066`, which reads the `task` section it points to. The check of roster ids against repository collaborators is also not done yet.
