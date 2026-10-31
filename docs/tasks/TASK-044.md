---
id: TASK-044
type: task
title: Confirm each write and record it in a local action log
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/95
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-003, AC-004]
assignee: claude-code
---

# TASK-044 Confirm each write and record it in a local action log

Tracked in [Issue #95](https://github.com/blcktgr73/Weaver/issues/95). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Give every write one path: build a plan that names the exact change, show it, run it only after the user approves that one action ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)), then append who or what did it and why to a local action log outside the repository. A `--yes` flag is not part of the first version.

## Done when

- A write command prints its plan and does nothing until it is confirmed.
- A declined or unanswered confirmation changes nothing and exits with a distinct code.
- Each executed action adds one line to the local log with time, actor, action, target, and reason.
- Anything the agent creates on GitHub says that the steward made it on behalf of the user.
- Tests cover confirmed, declined, and failed actions.
