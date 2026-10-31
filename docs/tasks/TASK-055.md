---
id: TASK-055
type: task
title: Register the maintainer's other projects in the fabric
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/117
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-055 Register the maintainer's other projects in the fabric

Tracked in [Issue #117](https://github.com/blcktgr73/Weaver/issues/117). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Add the maintainer's other repositories to `fabric.yaml`, and put their Issues on the central Project, so that the Overview shows them as lanes. Which repositories to add is the maintainer's decision; the agent lists the candidates and checks that each one can be read.

## Done when

- The maintainer names the repositories to register.
- Each registered repository has a lane on the Overview, and its Issues are on the Project, or the lane says it has none.
- The change to `fabric.yaml` goes through a pull request.
