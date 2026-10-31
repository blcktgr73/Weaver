---
id: TASK-041
type: task
title: Show the cards of a requirement or task on the Overview
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/82
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-011]
assignee: claude-code
---

# TASK-041 Show the cards of a requirement or task on the Overview

Tracked in [Issue #82](https://github.com/blcktgr73/Weaver/issues/82). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Add a Show on the Overview action to the requirement view and to a task file. It opens the Overview, turns the project on and unfolds its lane if needed, and highlights the cards of that requirement, or of that task from a task file.

## Done when

- The action opens or reveals the Overview and highlights the right cards.
- A hidden or folded lane is shown before the highlight.
- When the Overview cannot be built (no registry, not signed in), the action says why.
- Messages are in the catalog in English and Korean.
