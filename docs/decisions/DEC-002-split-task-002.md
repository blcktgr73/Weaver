# DEC-002: Split TASK-002 into scan/open and the Kanban projection

- Status: accepted
- Date: 2026-10-28
- Related: `REQ-001`, `TASK-002`, `TASK-005`

## Context

`TASK-002` had two meanings.

- `REQ-001` document: "Implement the VS Code workspace scan and requirement opener".
- Issue #2: "Build the first VS Code Kanban projection".

The implemented code (commit `0e33ada`) covers only the first. Leaving Issue #2 as it was would suggest that a Kanban exists, or would reopen work that is already done. The commit also landed without being linked to a task.

## Decision

- `TASK-002` is limited to **scan and requirement opener**. The title and body of Issue #2 were corrected to match.
- The **Kanban projection** moves to a new `TASK-005` (Issue #5).
- Issue #2 stays at `status:review`. The code exists, but manual verification in the Extension Development Host and a human approval remain. It is not raised to `verified` without evidence.
- The friction of a commit that was not linked to a task is recorded as `US-013`.
