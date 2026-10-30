# DEC-006: Verified needs a closing pull request, with explicit exceptions

- Status: accepted
- Date: 2026-10-30
- Related: `REQ-001`, `TASK-010`, [DEC-003](./DEC-003-board-status-mapping.md), `US-014`

## Context

A pull request that merely mentions an Issue is a link, not proof that it implements the task (`US-014`). AGENTS.md says work is not complete without evidence or an explicit exception. Tasks verified before CI and the `Closes #n` convention existed have merged pull requests that cannot meet a stricter rule.

## Decision

1. A task in **Verified** needs at least one **merged pull request that closes its Issue** (`Closes`, `Fixes`, or `Resolves` with the Issue number in the title or body). A merged pull request that only mentions the Issue is reported as a gap: `no merged pull request that closes the Issue`.
2. A pull request in Review still counts as evidence of work in progress; only Verified needs the closing pull request.
3. An **evidence exception** is a human-approved reason recorded in the task file as `evidence_exception: <reason>`. It replaces the evidence gaps of that task with the visible reason. The exception is reviewed in the pull request that adds it.
4. The board Status is derived from the label (DEC-003). When a board shows a different Status than the label implies, the view reports the mismatch. Reading board Status needs the GitHub `project` scope; without it the view reports nothing rather than guessing.

## Consequences

- The PR template asks for `Closes #n`.
- Tasks verified on 2026-10-30 before this rule (TASK-001, -002, -005, -006, -007) carry an exception that says so.
- A later change can expire exceptions or require a named approver.
