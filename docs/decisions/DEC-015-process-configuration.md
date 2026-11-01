# DEC-015: A repository describes its process in `.weaver/process.yaml`

- Status: proposed
- Date: 2026-11-01
- Related: `REQ-005`, `TASK-023`, `TASK-024` to `TASK-028`, `US-022`, `US-037`, amends [DEC-009](./DEC-009-keep-labels-for-columns.md), keeps [DEC-003](./DEC-003-board-status-mapping.md) and [DEC-006](./DEC-006-closing-pr-evidence.md) as the defaults, uses [DEC-014](./DEC-014-user-configuration.md)

## Context

[REQ-005](../requirements/REQ-005-configurable-process.md) asks that a repository can describe its process (columns, label mapping, evidence rules) in a file kept in Git, that Weaver behaves as it does today without the file, and that a team can adopt one part at a time.

The first dogfooding round gave a concrete case. ClawHub, BookPlay-Pro, DialogueLab, and HowMuchToday do not use `status:*` labels. Their board `Status` (Todo, In Progress, Done) says what is finished, but Weaver, following [DEC-003](./DEC-003-board-status-mapping.md) and [DEC-009](./DEC-009-keep-labels-for-columns.md), shows every closed card in Review with the gaps "no status label" and "closed without verified", and marks those cards as stale for having no pull request, although those repositories commit directly and do not pair each Issue with a pull request. The fixed rules fit this repository and do not fit these.

## Proposal

1. **Location.** A repository keeps its process in `.weaver/process.yaml` at its root, committed like any other file, because the process belongs to the team that works in the repository. Weaver reads it from the local clone when there is one, otherwise from GitHub (`GET /repos/{owner}/{name}/contents/.weaver/process.yaml`) with the person's token. A repository without the file uses the defaults.
2. **A personal fill-in.** For a repository whose owner has not committed a file, a person may give the same settings in their own `~/.weaver/config.yaml` under `process`, keyed by `owner/name`. The repository's own file wins; the personal entry is used only where the repository has none. Nothing is written into a repository to do this.
3. **Shape, version 1.** Every section is optional; a missing section or field keeps today's behavior.

   ```yaml
   version: 1

   columns:
     source: labels            # labels (default) | board-status
     labels:                   # used when source is labels; these are the defaults of DEC-003
       Backlog: status:backlog
       Ready: status:ready
       In progress: status:in-progress
       Blocked: status:blocked
       Review: status:review
       Verified: status:verified
     board:                    # used when source is board-status: board Status option -> column
       Todo: Backlog
       In Progress: In progress
       Done: Verified

   evidence:
     pull-request: required    # required (default) | optional: a pull request is expected in Review and Verified
     closing-pull-request: true  # Verified needs a merged pull request that closes the Issue (DEC-006); default true
     exceptions: true          # an `evidence_exception` in a task file is honored (DEC-006); default true

   stale:
     idle-days: 14             # default 14, which `weaver.staleDays` sets today
   ```

4. **What `columns.source` means.**
   - `labels` is today's rule: the `status:*` label and the Issue state decide the column; the board Status is only compared with it (DEC-003, DEC-009).
   - `board-status` makes the Project board's `Status` decide, through `columns.board`. An Issue whose Status is not in the map, or that is not on the Project, falls back to its state: closed is Verified, open is Backlog. A closed Issue whose Status is not the one mapped to Verified, and an open Issue whose Status is, are shown as gaps. No label is read or written, and the label-based checks (board differs from label, closed Issue without the Verified label) do not apply.
   - With a board that has only three Status values, Ready, Blocked, and Review cannot be told apart from their neighbors. That is a limit of the board, not of Weaver.
5. **Fixed in version 1.** The six columns and their order stay as they are ([DEC-009](./DEC-009-keep-labels-for-columns.md) item 1 is kept for the set of columns). The file configures where a column comes from and the rules around evidence, not which columns exist. Renaming, hiding, or adding columns, and configuring the ID patterns (`REQ-###`, `TASK-###`, `AC-###`), are left for a later version, because they reach the parser and every view.
6. **Partial and wrong files.** Each section is judged on its own. A section that has an error is reported (in the Problems panel and in the setup view) and ignored, so that section keeps its defaults, and the other sections still apply. A file that is not valid YAML is reported and the whole file is ignored. An unknown field is a warning and is kept, as elsewhere.
7. **Adopting one part at a time.** Because a missing section means "default", a team can add `columns` first and `evidence` later. The view shows, for each section, whether it comes from the repository file, from the personal fill-in, or is a default (`TASK-027`).
8. **Where it takes effect.** The column of a card, the move of a card (which label, state, or board Status it changes), the mismatch checks, the stale marks, the evidence gaps, and the steward's reconcile rules all read the same settings, so the editor and the `weaver` tool agree.

## Examples

- **This repository** commits the defaults, spelled out, as the worked example for the migration guide (`TASK-028`).
- **HowMuchToday** would say:

  ```yaml
  version: 1
  columns:
    source: board-status
  evidence:
    pull-request: optional
    closing-pull-request: false
  ```

  Its closed cards then show as Verified, and the seven "no linked pull request" marks go away because the team does not expect one.

## Alternatives considered

- **Only in the personal file.** Simple, but the process is a fact about the repository: two people on the same team must see the same columns. Kept only as a fill-in for repositories one does not own.
- **In Project fields.** Needs a custom field on every Project, which [DEC-009](./DEC-009-keep-labels-for-columns.md) rejected.
- **A free set of columns now.** The most flexible, and the largest change; deferred until the source and rules have been used.

## Consequences

- `TASK-024` reads the file and keeps the defaults without behavior change; `TASK-025` and `TASK-026` apply the columns and evidence settings; `TASK-027` shows the source of each section; `TASK-028` writes the migration guide with this repository's file as the example.
- `placeIssue` and the move, mismatch, stale, evidence, and reconcile code take the settings instead of constants.
- [DEC-009](./DEC-009-keep-labels-for-columns.md) gets a note that a repository may choose `board-status`; its default stays labels.

## Questions for the maintainer

1. Is `.weaver/process.yaml` in each repository the right home, with the personal fill-in for repositories one does not own (item 2)?
2. Is it right to keep the six columns fixed in version 1 and configure only where they come from and the evidence rules (item 5)?
3. Should the personal fill-in win over the repository's file instead of only filling gaps?
4. Which rules do the other repositories need first? The proposal covers the column source and the pull-request expectation, which is what HowMuchToday, ClawHub, BookPlay-Pro, and DialogueLab showed.
