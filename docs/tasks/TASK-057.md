---
id: TASK-057
type: task
title: Read the user configuration and keep the workspace file as an optional shared one
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/122
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-057 Read the user configuration and keep the workspace file as an optional shared one

Tracked in [Issue #122](https://github.com/blcktgr73/Weaver/issues/122). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-014](../decisions/DEC-014-user-configuration.md).

Read `~/.weaver/config.yaml` (`WEAVER_HOME` moves the folder) with the fields of [DEC-014](../decisions/DEC-014-user-configuration.md): `project`, optional `repositories`, optional `roster`. A workspace `fabric.yaml` still works and decides `project` and `repositories` for that workspace. The roster always comes from the personal file. The extension and the `weaver` tool use the same reader.

## Done when

- A parser for the configuration reports what is wrong in the same way as the registry parser and returns a configuration only without errors.
- The order of sources is the workspace `fabric.yaml`, then the personal file; with neither, the message says how to set it up.
- A Project can be read without a repository list: every Issue of a repository is accepted, and the repositories are taken from the cards.
- The `weaver` tool takes the configuration from this reader; `--root` still points at a workspace `fabric.yaml`.
- Tests cover both files, the order, a missing repository list, and a roster entry.
