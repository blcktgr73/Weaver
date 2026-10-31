---
id: TASK-047
type: task
title: Move a card and attach evidence from the command line
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/98
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-003]
assignee: claude-code
---

# TASK-047 Move a card and attach evidence from the command line

Tracked in [Issue #98](https://github.com/blcktgr73/Weaver/issues/98). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Add `weaver card move` and `weaver evidence attach`. A move changes the status label and the Issue state the way the editor does ([DEC-003](../decisions/DEC-003-board-status-mapping.md)); a move to Verified needs evidence or an explicit exception, and never happens without confirmation.

## Done when

- A move lists the labels and state it will change, then asks.
- A move to Verified without a linked pull request or an exception is refused with the reason.
- `evidence attach` links a merged pull request to the card as a comment that names the steward.
- The editor and the tool call the same move logic.
- Tests cover each column and the refusal.
