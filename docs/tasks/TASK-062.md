---
id: TASK-062
type: task
title: Fold the finished cards of the Overview by default
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/149
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-014]
assignee: claude-code
---

# TASK-062 Fold the finished cards of the Overview by default

Tracked in [Issue #149](https://github.com/blcktgr73/Weaver/issues/149). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Finished work only grows, and on a Project with many repositories it hides the work in progress. The Overview folds the finished cards by default (the Verified column and every card whose Issue is closed) and shows how many are folded.

## Done when

- Finished cards (Verified, or a closed Issue) are folded by default; each lane shows only their count in the Verified column. A finished card with a gap stays visible.
- One control in the header unfolds and folds them again, and the choice is kept on this computer only.
- Showing a requirement or a task on the Overview unfolds them when a highlighted card is among them.
- The lane totals and the mismatch checks still include the folded cards.
- The behavior is checked by hand in the development host.

## Progress

- Built: `isFinished` and `foldFinished` in the shared package (a card is finished when it is in Verified or its Issue is closed, and it has no gap); the Overview folds finished cards by default, shows "N finished, folded" in the Verified column of each lane, and has one header button, "Show finished (N)" / "Hide finished"; the choice is kept on this computer; a highlighted finished card unfolds them. Lane totals and the mismatch checks still count every card.
- Not yet done: the last "Done when" item. The page was rendered in both states by hand and `npm run check` and the tests pass, but it was not driven in the development host.