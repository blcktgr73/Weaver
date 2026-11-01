---
id: TASK-059
type: task
title: Set up the configuration from the terminal with weaver init
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/124
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-059 Set up the configuration from the terminal with weaver init

Tracked in [Issue #124](https://github.com/blcktgr73/Weaver/issues/124). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-014](../decisions/DEC-014-user-configuration.md).

Add `weaver init`, which asks the setup questions of [DEC-014](../decisions/DEC-014-user-configuration.md) in a terminal: confirm the sign-in, choose a Project, untick repositories to leave out, pick roster candidates and add agents, optionally set the clone folder. It shows what it will write and writes `~/.weaver/config.yaml` only after confirmation. It does not overwrite an existing file without asking.

## Done when

- The questions and the result go through the English and Korean catalog.
- Without a terminal, the command prints what it needs and exits with a distinct code instead of waiting.
- Running it again edits the existing configuration rather than starting over.
- The agent contract and the getting-started guide describe it.
