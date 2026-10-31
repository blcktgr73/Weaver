---
id: TASK-045
type: task
title: Add existing Issues to the Project from the command line
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/96
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-003]
assignee: claude-code
---

# TASK-045 Add existing Issues to the Project from the command line

Tracked in [Issue #96](https://github.com/blcktgr73/Weaver/issues/96). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Add `weaver project add <issue-url>...`, the first write and the one that fixes the largest group of mismatches (a task whose Issue is not on the Project). It uses the write path of TASK-044.

## Done when

- One or more Issue addresses can be added in a single command, each confirmed as part of one plan.
- An Issue already on the Project is reported and skipped.
- An Issue of a repository that is not registered is refused with the reason.
- Tests cover added, already present, and refused Issues.
