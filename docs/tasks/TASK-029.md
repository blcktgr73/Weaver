---
id: TASK-029
type: task
title: Verify Project read access and record the registry decision
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/61
repository: blcktgr73/Weaver
assignee_type: human
criteria: [AC-001]
assignee: blcktgr73
---

# TASK-029 Verify Project read access and record the registry decision

Tracked in [Issue #61](https://github.com/blcktgr73/Weaver/issues/61). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Check whether a fine-grained token can read a personal Project, and which scopes an organization Project needs. Check whether the VS Code GitHub sign-in can read all items of a Project. Record the result as an addition to DEC-010. The agent drafts the check; the maintainer decides.

## Done when

- DEC-010 records which login each client uses and the scopes checked for a personal Project (done: `gh` classic token with `repo` and `project`).
- DEC-010 says what is not verified: fine-grained tokens, organization Projects, and the VS Code sign-in (the last is confirmed in `TASK-031`).
- The behavior without the `project` scope is decided (DEC-010, item 6).

Scope change on 2026-10-31: the maintainer chose to reuse the existing `gh` and VS Code logins and not to test fine-grained tokens.
