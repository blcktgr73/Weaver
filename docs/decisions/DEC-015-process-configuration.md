# DEC-015: A repository describes its process in `.weaver/process.yaml`

- Status: accepted on 2026-11-01 by the maintainer, except the open point at the end
- Date: 2026-11-01
- Related: `REQ-005`, `TASK-023`, `TASK-024` to `TASK-028`, `US-022`, `US-037`, amends [DEC-009](./DEC-009-keep-labels-for-columns.md), keeps [DEC-003](./DEC-003-board-status-mapping.md) and [DEC-006](./DEC-006-closing-pr-evidence.md) as the defaults, uses [DEC-014](./DEC-014-user-configuration.md)

## Context

[REQ-005](../requirements/REQ-005-configurable-process.md) asks that a repository can describe its process (columns, label mapping, evidence rules) in a file kept in Git, that Weaver behaves as it does today without the file, and that a team can adopt one part at a time.

The first dogfooding round gave a concrete case. ClawHub, BookPlay-Pro, DialogueLab, and HowMuchToday do not use `status:*` labels. Their board `Status` (Todo, In Progress, Done) says what is finished, but Weaver, following [DEC-003](./DEC-003-board-status-mapping.md) and [DEC-009](./DEC-009-keep-labels-for-columns.md), shows every closed card in Review with the gaps "no status label" and "closed without verified", and marks those cards as stale for having no pull request, although those repositories commit directly and do not pair each Issue with a pull request. The fixed rules fit this repository and do not fit these.

## Decision

1. **Location.** A repository keeps its process in `.weaver/process.yaml` at its root, committed like any other file, because the process belongs to the team that works in the repository. Weaver reads it from the local clone when there is one, otherwise from GitHub (`GET /repos/{owner}/{name}/contents/.weaver/process.yaml`) with the person's token. A repository without the file uses the defaults.
2. **The repository is the single source of truth.** There is no personal override or fill-in of a repository's process. What a person sets in `~/.weaver/config.yaml` is which Project and repositories they look at and who is in their roster ([DEC-014](./DEC-014-user-configuration.md)); how a repository's work is tracked is stated in the repository, so everyone who reads it sees the same board. A repository without the file uses the defaults. To change how a repository is read, change its file.
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
5. **Fixed in version 1.** The six columns and their order stay as they are ([DEC-009](./DEC-009-keep-labels-for-columns.md) item 1 is kept for the set of columns). The file configures where a column comes from and the rules around evidence, not which columns exist. The reason is that the Overview is one board for many repositories: its columns are the axis that every lane shares, so a repository maps *onto* the six columns instead of bringing its own. Renaming, hiding, or adding columns, and configuring the ID patterns (`REQ-###`, `TASK-###`, `AC-###`), are left for a later version, because they reach the parser, the mover, the stale rules, and every view.
6. **Partial and wrong files.** Each section is judged on its own. A section that has an error is reported (in the Problems panel and in the setup view) and ignored, so that section keeps its defaults, and the other sections still apply. A file that is not valid YAML is reported and the whole file is ignored. An unknown field is a warning and is kept, as elsewhere.
7. **Adopting one part at a time.** Because a missing section means "default", a team can add `columns` first and `evidence` later. The view shows, for each section, whether it comes from the repository file, from the personal fill-in, or is a default (`TASK-027`).
8. **Where it takes effect.** The column of a card, the move of a card (which label, state, or board Status it changes), the mismatch checks, the stale marks, the evidence gaps, and the steward's reconcile rules all read the same settings, so the editor and the `weaver` tool agree.
9. **How the files are read: by priority, from a cache, and only what is needed.** The process of a repository changes rarely, while its cards change often, so the files are read in this way (decided with the maintainer on 2026-11-01):
   - *Cache first.* The last text of each file is kept on the person's computer with its `ETag`. A view draws from the cache at once, asks GitHub with a conditional request in the background, and draws again only if the file changed. A repository without the file (404) is remembered as "no file" and asked about again later in the same way.
   - *By priority.* The current repository is read first: the lane the person used last before the editor closed, else the lane used most recently. The other visible lanes follow, at most four requests at a time. A lane that is folded or hidden is read only when it is shown.
   - *No wrong first picture.* A repository whose file has never been read is not drawn with the defaults, which could place its cards in the wrong columns for a moment. It is shown as "reading its process" until the file arrives; the current repository is read before the first picture is drawn.
   - *Honest about what is not checked.* The mismatch list, the stale marks, and the steward's reconcile need every lane's rules. While a lane has not been read they cover only the lanes that were, and the view says how many lanes are not checked yet.
   - *Per view.* A Requirement view reads only its own repository when it opens. The `weaver` tool has no screen to keep responsive and reads every repository at once.

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

- **Only in the personal file, or a personal fill-in.** The process is a fact about the repository: two people on the same team must see the same columns. Two sources of truth would also let the board differ from person to person.
- **In Project fields.** Needs a custom field on every Project, which [DEC-009](./DEC-009-keep-labels-for-columns.md) rejected.
- **A free set of columns now.** The most flexible, and the largest change; deferred until the source and rules have been used.

## Consequences

- A repository shared with colleagues who do not use Weaver keeps working: the file describes how their work is already tracked (for example the board Status) and asks nothing of them. They need no labels they do not use.
- `TASK-024` reads the file and keeps the defaults without behavior change; `TASK-025` and `TASK-026` apply the columns and evidence settings; `TASK-027` shows the source of each section; `TASK-028` writes the migration guide with this repository's file as the example.
- `placeIssue` and the move, mismatch, stale, evidence, and reconcile code take the settings instead of constants.
- [DEC-009](./DEC-009-keep-labels-for-columns.md) gets a note that a repository may choose `board-status`; its default stays labels.

## Decided with the maintainer

1. `.weaver/process.yaml` in each repository is the home of the process.
2. Version 1 keeps the six columns and configures only where they come from and the evidence rules.
3. The repository is the single source of truth; there is no personal override.

## Known limits

- **A GitHub Project board with three Status values (Todo, In Progress, Done) cannot tell Ready, Blocked, and Review from their neighbors.** A repository that uses `board-status` on such a board shows those three columns empty. This is a limit of the board, not of Weaver. A repository that needs the finer columns can use the `status:*` labels, or give its board a richer Status field.

## Deferred

- **A personal overlay of a repository's process.** The repository stays the single source of truth. For a repository one does not own, a person may later want to keep their own *differences* from its process outside the repository (in the personal configuration), and to see in the view where their reading differs from the repository's. The name is "overlay": it is laid over the repository's file without changing it, and it is shown, not hidden. It is not needed yet, so it is not built and not specified. It is taken up when a real case appears.
- **Further rules.** They are added when a repository asks for one. The first round only showed the column source and the pull-request expectation. The decision is to settle on this, watch what happens in the dogfooding, and add what is missing.
- **The roster of a project.** See [DEC-014](./DEC-014-user-configuration.md): the humans of a repository can be taken from its GitHub collaborators, which are already the repository's own record of who works on it.
