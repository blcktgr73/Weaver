---
id: TASK-023
type: task
title: Decide the process configuration format
requirement: REQ-005
issue: https://github.com/blcktgr73/Weaver/issues/53
repository: blcktgr73/Weaver
assignee_type: human
criteria: [AC-001]
assignee: blcktgr73
---

# TASK-023 Decide the process configuration format

Tracked in [Issue #53](https://github.com/blcktgr73/Weaver/issues/53). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Write a decision record: the file name and location, the settings it holds (columns and label mapping, evidence rules, ID patterns), and how a missing or partial file falls back to today's behavior. The agent drafts it; the maintainer decides.

The decision must also cover a repository that has no `status:*` labels. Registering ClawHub, BookPlay-Pro, DialogueLab, and HowMuchToday showed that their closed Issues all appear in Review with gaps, while their board Status says Todo, In Progress, or Done. State which source decides the column (labels, board Status, or a mapping between them) and how a repository chooses.

## Draft

The draft is [DEC-015](../decisions/DEC-015-process-configuration.md) (status: proposed). It is done when the maintainer accepts or changes it; `TASK-024` to `TASK-028` wait for that.
