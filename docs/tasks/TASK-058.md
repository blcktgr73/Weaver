---
id: TASK-058
type: task
title: Discover the Projects of a user and the repositories on a Project
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/123
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-058 Discover the Projects of a user and the repositories on a Project

Tracked in [Issue #123](https://github.com/blcktgr73/Weaver/issues/123). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-014](../decisions/DEC-014-user-configuration.md).

Setup needs two reads from GitHub: the Projects a person can see (their own and those of their organizations), and the repositories that have cards on a chosen Project with the number of cards, plus the assignees found on those cards for the roster. Put them in `packages/github` with an injectable fetch.

## Done when

- The Projects of the signed-in user and of their organizations are listed with owner, number, title, and card count.
- The repositories on a Project are listed with the number of Issues on it, and the assignees seen on its cards.
- A person without the `project` scope, a missing Project, and a rate limit each give a notice.
- Tests use an injected fetch.
