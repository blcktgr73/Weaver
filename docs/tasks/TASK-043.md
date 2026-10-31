---
id: TASK-043
type: task
title: Create the weaver command-line tool with a JSON contract and list and show
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/94
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-006, AC-007, AC-008]
assignee: claude-code
---

# TASK-043 Create the weaver command-line tool with a JSON contract and list and show

Tracked in [Issue #94](https://github.com/blcktgr73/Weaver/issues/94). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Add a `packages/cli` workspace that exposes `weaver list` and `weaver show <card>`. Output is JSON by default and readable text with a flag. The tool reads the registry and Project through `packages/github` and the files through `packages/markdown`, and takes its token from `gh auth token`, never from a file in the repository.

## Done when

- `weaver list` prints every card of the Project as JSON, with its repository, task, requirement, column, and stale marks.
- `weaver show <card>` prints one card with its Issue, task file, requirement, and pull requests.
- The tool needs no editor; the logic is shared with the extension rather than copied.
- Messages that a person reads go through the English and Korean catalog.
- Tests cover the JSON shape with an injected fetch.
