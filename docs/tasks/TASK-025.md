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
- Done (editor): the Overview and the Requirement view place cards and plan moves with each repository's rules. The last answer of each repository is kept (with its ETag), so the next Overview starts from it and checks for a change after the board is shown. A repository never asked is waited for, so there is no first picture drawn from guessed rules. The Requirement view asks only the repositories of its own tasks. A move to a column the board cannot show is refused with a message. A repository's `stale.idle-days` replaces the `weaver.staleDays` setting for its cards.
- Done (reading order): the Overview no longer waits for every process file. It draws the board at once. A lane whose repository was never read says "reading how this repository tracks its work", and its cards are left out of the stale marks and the mismatch checks (a note says how many lanes are not checked yet), so nothing is judged by guessed rules. The lanes are read four at a time, in lane order and unfolded lanes before folded ones. A lane that is hidden is read only when it is shown. Repositories with a kept answer draw from it at once and are checked for a change afterwards. A repository whose file cannot be read keeps today's defaults rather than waiting.
- Not done as the decision words it: "the lane used last before the editor closed" is approximated by the lane order the person chose (the top lane first); the editor does not record which lane was used last.
- The editor was not driven by hand against a real repository that has a process file; the page was rendered once to check the text.
