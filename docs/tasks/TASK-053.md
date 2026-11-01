---
id: TASK-053
type: task
title: Reconcile the two mismatches that need a file change as pull requests
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/115
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-003, AC-004]
assignee: claude-code
---

# TASK-053 Reconcile the two mismatches that need a file change as pull requests

Tracked in [Issue #115](https://github.com/blcktgr73/Weaver/issues/115). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

DEC-012 proposes a fix for a task file without an Issue (create the Issue and link it) and for a card without a file (draft the task file). Both change repository files, so they are offered as pull requests through the same worktree path as `weaver task create`. Until now `weaver reconcile` only reports them.

## Done when

- A task file without an Issue gets a planned Issue and a pull request that adds the Issue link to the task file.
- A card without a file gets a pull request that drafts the task file from the Issue, listed under its requirement when one can be named; when none can, it stays a report.
- Each is one confirmed action set; nothing is committed to the default branch.
- Tests cover both, with a fake `git` and GitHub.

## Progress

- `weaver reconcile` now offers both fixes as actions: a task file without an Issue (create the Issue, put it on the Project, open a pull request that writes the link into the task file and the requirement's task line; an existing card of the Project is linked instead of creating a duplicate), and a card without a file (a pull request that drafts the task file from the Issue and lists it under the requirement the Issue names). Each is one confirmed action set run in a separate worktree, nothing is committed to the default branch, and a fix whose pull request is already open is not offered again.
- A card whose requirement cannot be named (no `REQ-###` of the same repository in its title or body) stays a report.
- Tests use a fake `git`, `gh`, and GitHub. `weaver reconcile` was run (dry run only) against the real Project; no file fix was applied for real.
