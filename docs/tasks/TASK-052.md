---
id: TASK-052
type: task
title: Show the errors of the weaver tool in the chosen language
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/114
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-008]
assignee: claude-code
---

# TASK-052 Show the errors of the weaver tool in the chosen language

Tracked in [Issue #114](https://github.com/blcktgr73/Weaver/issues/114). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

The text of an error that comes from GitHub or from a step of the tool (for example "GitHub answered 403.") is English only, so a failed action shows English inside an otherwise Korean result. Raise notices with a catalog key and arguments instead of text, format them in the chosen language for the person, and keep English in the action log.

## Done when

- Every sentence that the tool itself writes into a failed action is a catalog message in English and Korean. Text that a program such as `git` or `gh` printed is passed on as it is.
- The action log keeps English so that it reads the same for everyone.
- Tests cover a failed Issue call, a failed pull request, and a failed move step in both languages.
