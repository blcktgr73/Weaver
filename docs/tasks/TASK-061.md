---
id: TASK-061
type: task
title: Move the committed registry and roster out of the repository and write the migration note
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/126
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-061 Move the committed registry and roster out of the repository and write the migration note

Tracked in [Issue #126](https://github.com/blcktgr73/Weaver/issues/126). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-014](../decisions/DEC-014-user-configuration.md).

This repository still holds a `fabric.yaml`. Remove it, keep `examples/overview/fabric.yaml` as the example of the shared format, add a `config.example.yaml`, update the guides that told people to write `fabric.yaml`, and write what a person with the old file has to do.

## Done when

- The repository has no personal registry or roster; the examples and guides show the new setup.
- The guide for registering a Project is rewritten around the setup procedure.
- A note says how to move from a `fabric.yaml` to the personal file.
- The development scripts (`npm run dev:overview`) still work through the example workspace.
