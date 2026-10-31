# DEC-009: Keep Issue labels as the source of the six columns

- Status: accepted
- Date: 2026-10-31
- Related: `REQ-006`, [DEC-003](./DEC-003-board-status-mapping.md), [DEC-006](./DEC-006-closing-pr-evidence.md), [DEC-007](./DEC-007-central-project-is-configuration.md)

## Context

[DEC-003](./DEC-003-board-status-mapping.md) derives the six Kanban columns from Issue labels and treats the board `Status` as a summary. It left a six-value board field (its option B) open for a later decision. With a central Project that other teams register for themselves ([DEC-007](./DEC-007-central-project-is-configuration.md)), the question returns: should Weaver require a custom `Stage` field on the Project?

## Decision

1. DEC-003 stays in force. The six columns come from the `status:*` label and the Issue state.
2. Weaver does not require any custom field on a Project. A Project with only the default `Status` works.
3. The mismatch between the board `Status` and the label is reported by the existing check ([DEC-006](./DEC-006-closing-pr-evidence.md), item 4) and by the Overview's mismatch list in REQ-006.
4. A `Stage` field may be added later as an optional field, with its own decision, if the Blocked and Review columns must be told apart on the board itself.

## Reasons

- A required custom field raises the setup cost for every team that registers its own Project.
- Labels exist in every repository and show in the Issue list without a Project, which also suits the read-only fallback view.

## Consequences

- On the board, Blocked and Review look alike. The Weaver view tells them apart.
- A person who edits `Status` on the board can make it disagree with the label; the mismatch list shows it instead of hiding it.
