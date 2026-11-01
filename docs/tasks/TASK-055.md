---
id: TASK-055
type: task
title: Show the maintainer's other projects on the Overview
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/117
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-055 Show the maintainer's other projects on the Overview

Tracked in [Issue #117](https://github.com/blcktgr73/Weaver/issues/117). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Use the setup of [DEC-014](../decisions/DEC-014-user-configuration.md) to put the maintainer's other projects on their own Overview. Nothing about which repositories one person looks at is committed to a repository. The first try, a committed `fabric.yaml` with ClawHub, BookPlay-Pro, and DialogueLab, was dropped for that reason. It depends on `TASK-057` to `TASK-060`.

## Done when

- The maintainer's own configuration shows ClawHub, BookPlay-Pro, and DialogueLab as lanes next to Weaver and HowMuchToday.
- No repository file was changed to do it.
