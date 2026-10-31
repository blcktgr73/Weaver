---
id: TASK-029
type: task
title: Verify Project read access and record the registry decision
requirement: REQ-006
status: draft
repository: blcktgr73/Weaver
assignee_type: human
criteria: [AC-001]
assignee: blcktgr73
---

# TASK-029 Verify Project read access and record the registry decision

Check whether a fine-grained token can read a personal Project, and which scopes an organization Project needs. Check whether the VS Code GitHub sign-in can read all items of a Project. Record the result as an addition to DEC-010. The agent drafts the check; the maintainer decides.

## Done when

- The result is written in DEC-010 with the exact scopes for a personal and an organization Project.
- The error shown to a user without the scope is decided.
