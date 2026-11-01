---
id: TASK-025
type: task
title: Drive columns and label mapping from the configuration
requirement: REQ-005
issue: https://github.com/blcktgr73/Weaver/issues/55
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-003]
assignee: claude-code
---

# TASK-025 Drive columns and label mapping from the configuration

Tracked in [Issue #55](https://github.com/blcktgr73/Weaver/issues/55). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Kanban columns, their order, and the label or state each one maps to come from the configuration, falling back to the defaults per setting.

## Progress

- Done: the column rules (`ColumnRules`) are an argument of `placeIssue`, `planMove`, `boardGaps`, and `findMismatches`; without them the answers are today's. The CLI reads each repository's process once and uses its labels, its board map, and its idle days for `list`, `show`, `card move`, and `reconcile`. A move to a column the board has no Status for is refused, not guessed.
- Not yet: the editor (Overview, Requirement view, status bar) still uses the defaults, and the cache-first, priority-ordered reading of DEC-015 item 9 is not built. This task stays open until both are.

