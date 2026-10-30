# DEC-003: How the shared board Status relates to the Weaver Kanban columns

- Status: accepted
- Date: 2026-10-30
- Related: `REQ-001`, `TASK-005`, `TASK-007`, [DEC-001](./DEC-001-status-vocabulary.md)

## Context

The `Status` field of the shared board (PALab Ops Kanban) has three values: `Todo / In Progress / Done`. The Weaver Kanban has six columns: Backlog, Ready, In progress, Blocked, Review, Verified. When a card moves, one side has to be the source of truth.

## Decision (option A)

- **The source of the six columns is the Issue label (`status:*`) and the Issue state (open/closed).**
- The board `Status` field is a **summary derived from them**. Board settings are not changed.

| Weaver column | Issue label | Issue state | Board Status |
| --- | --- | --- | --- |
| Backlog | `status:backlog` | open | Todo |
| Ready | `status:ready` | open | Todo |
| In progress | `status:in-progress` | open | In Progress |
| Blocked | `status:blocked` | open | In Progress |
| Review | `status:review` | open | In Progress |
| Verified | `status:verified` | closed | Done |

## Consequences

- Moving a card sets the label, the Issue state, and the board Status together. `planMove` in `packages/markdown` is the single rule.
- Blocked and Review cannot be told apart on the board. Use the Weaver view when the difference matters.
- A person who changes Status directly on the board can make it disagree with the label. Showing that disagreement as a gap is follow-up work.
- Option B, a new board field with six values, was not adopted. It can be revisited with a new decision if it becomes necessary.
