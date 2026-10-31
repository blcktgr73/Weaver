# DEC-011: The offline board is the last board read from GitHub

- Status: accepted
- Date: 2026-11-01
- Related: `REQ-006`, `TASK-037`, `TASK-042`, [DEC-003](./DEC-003-board-status-mapping.md), [DEC-005](./DEC-005-task-files.md)

## Context

`TASK-037` shows a board built from the repository files when GitHub cannot be read. In this repository a task file that has an Issue does not carry a `status` ([DEC-005](./DEC-005-task-files.md)), so that board puts every card in Backlog as "state unknown". It is honest but not useful.

## Decision

1. Each time the Overview reads the Project successfully, it keeps that read on this computer (VS Code `globalState`): the Project owner and number, its title, the cards, and the time of the read.
2. When GitHub cannot be read, the Overview shows the kept board and says how long ago it was read. Requirement links still come from the files in the workspace.
3. The board built from files stays as the fallback when no read has been kept yet, or when the kept read belongs to a different Project than `fabric.yaml` names now.
4. The kept read is never written to the repository and never shared. It can be deleted at any time without losing intent, because the Project is a rebuildable copy ([DEC-007](./DEC-007-central-project-is-configuration.md)).
5. A kept board is read-only and shows no stale marks or mismatches, because those judge the state against the present time and the present files.

## Reasons

- The last read has the real columns, so it is closer to the truth than a guess from files.
- Keeping it on the computer follows the rule that the repository holds intent and GitHub holds state; Weaver adds no new place that claims to be authoritative.

## Consequences

- The acceptance criterion for the offline board in `REQ-006` now says "the last board read, or the files".
