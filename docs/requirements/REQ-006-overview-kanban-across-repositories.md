---
id: REQ-006
type: requirement
title: One Overview Kanban shows all registered repositories and starts every exploration
status: draft
owner: PALab
story_ids: [US-025, US-026, US-029, US-030, US-035, US-036]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# One Overview Kanban shows all registered repositories and starts every exploration

## Problem

A team that works across several repositories has no single place to see all of its work. The Kanban in Weaver today belongs to the one repository that is open in VS Code. Teams fall back on Notion pages that hold only a ticket title, or on chat threads where ticket A is forgotten while B and C are discussed. Nobody wants to spend energy keeping a board current by hand, and a board that is not current is abandoned.

## Outcome

Opening Weaver shows one Overview Kanban for every registered repository. It is the starting point of exploration: from a card the user reaches the requirement, the task, the evidence, and the repository. The board is read from a central GitHub Project that agents and humans share, and the repositories remain the source of truth for intent. Weaver reports where the board, the Issues, and the repository files disagree, so that a later agent (see [REQ-007](./REQ-007-steward-agent-for-the-kanban.md)) has a clear list to work from.

## Authority boundaries

```text
Repository Markdown     → requirements, tasks, acceptance criteria, decisions (source of truth)
GitHub Issue            → task execution state (DEC-003)
Central GitHub Project  → shared board that collects the Issues of all registered repositories
Fabric registry         → which repositories belong to the fabric (a Git file)
Overview Kanban         → derived view; can be rebuilt from the repositories and Issues
```

The central Project is a shared copy that can be rebuilt. If it is lost or wrong, no requirement or task intent is lost.

## Acceptance criteria

- A person's configuration, kept outside any repository (`~/.weaver/config.yaml`), names the central Project and, optionally, the repositories to show; without a list, every repository that has cards on the Project is shown. A workspace may share a `fabric.yaml` with the same fields. A setup procedure in the editor and in the terminal writes the file.
- Each user can set a local fabric root folder, which is not shared. A command clones every registered repository that is missing under that folder and skips the ones already there. Opening the fabric root in VS Code shows all of them in one workspace.
- Weaver opens on the Overview Kanban when a fabric is configured. The columns are the Kanban stages and the lanes are the registered repositories, in the order of the registry, so a card shows which project it belongs to.
- A user can reorder, collapse, hide, and filter lanes. These choices are stored on that user's computer and never in the repository. A collapsed lane still shows its card count and its blocked-card count.
- Pressing a card title opens its requirement view scrolled to the task, or the Issue when no requirement file is visible. A right-click menu on a card lists the task file, the requirement source, the Issue, a pull request that refers to it, and the repository folder; a place that cannot open stays in the list with the reason.
- Cards that have not moved for a set time, that have no evidence, or that wait for a human decision are marked on the board.
- Weaver lists mismatches between the repository files, the Issues, and the central Project, using these kinds: task file without an Issue, Issue link that is not an Issue address, task whose Issue is not on the Project, Project card without a task file (for repositories whose files are in the workspace), merged pull request that names a task in its branch or trailing `(TASK-###)` but does not close its Issue (`docs:` pull requests and Issues that are already closed are left out), and board status that disagrees with the label. This check only reports; it changes nothing.
- When GitHub cannot be reached, Weaver shows a read-only Kanban, the last board it read or else one built from the repository files, and says that the state is not current.
- A repository can be viewed on the Overview without being opened as its own VS Code folder.
- Every user-facing message for this feature is in the message catalog in English and Korean.
- A requirement view does not carry a second Kanban board. It shows one line of stage counts for its tasks, and the Overview is the only board.
- From a requirement view or a task file, an action shows its cards on the Overview: the project is turned on, its lane is unfolded, and the cards of that requirement or task are highlighted.
- Each successful read of the Project is kept on the user's computer, never in the repository. When GitHub cannot be read, the Overview shows that board with its age, and falls back to the files only when no read of the same Project was kept.

## Open decisions

- **Read access.** A classic token with the `repo` and `project` scopes reads a personal Project ([DEC-010](../decisions/DEC-010-fabric-registry-location.md)). Organization Projects and fine-grained tokens are not verified yet.

## Decisions taken

- The central Project is configuration. PALab keeps PALab Ops Kanban, and other teams register their own: [DEC-007](../decisions/DEC-007-central-project-is-configuration.md).
- The registry format is `fabric.yaml` ([DEC-010](../decisions/DEC-010-fabric-registry-location.md)), but a person's own configuration lives in `~/.weaver/config.yaml` and the repository list can be derived from the Project: [DEC-014](../decisions/DEC-014-user-configuration.md).
- The six columns stay derived from Issue labels, and no custom Project field is required: [DEC-009](../decisions/DEC-009-keep-labels-for-columns.md).
- The offline board is the last board read from GitHub, kept on the user's computer: [DEC-011](../decisions/DEC-011-offline-board-from-last-read.md).

Open decisions are recorded as `DEC-###` documents before the related tasks start.

## Review of remaining gaps (2026-11-01)

Each criterion was checked against the code and its tests. The rows say where the proof is and what is still unproven.

| Criterion | Proof | Not yet proven |
| --- | --- | --- |
| AC-001 registry | `parseConfig` and `parseFabric` tests, `config.example.yaml`, `examples/overview/fabric.yaml`, DEC-010, DEC-014 | Registry in a hub repository (the parser does not assume a location) |
| AC-002 fabric root and clone | `clone.ts` tests, the commands in the extension | Clone run against a real remote from the editor |
| AC-003 opens on the Overview, lanes in registry order | `overviewHtml` render checks, seen in the editor | none |
| AC-004 reorder, collapse, hide, filter lanes | `applyLaneOrder`, `moveLane` tests, seen in the editor (chips, fold, scroll) | The up and down buttons |
| AC-005 card actions | Seen in the editor: a card title opens its requirement view. `TASK-050` opens the views as tabs | The right-click menu, and the new-tab behavior after `TASK-050` |
| AC-006 stale marks | `staleNotices` tests; the real Project gives the expected marks | Their look on the board |
| AC-007 mismatches | `findMismatches` tests; seen in the editor, and fixed against real data | none |
| AC-008 offline board | Snapshot and file-board tests, render checks | Run with the network switched off |
| AC-009 repository without a folder | Cards come from the Project, not from open folders | none |
| AC-010 messages in the catalog | en/ko parity test | none |
| AC-011 requirement view without a board | Stage summary, seen in the editor | none |
| AC-012 show on the Overview | `focusCards` tests | The button in the editor |
| AC-013 last read kept | `snapshot` tests | A second launch after a successful read |

The editor behaviors in the right column cannot be driven by the test suite; they are listed so that a person can check them in one pass in the development host (`npm run dev:overview`).

## Tasks

- `TASK-029` Verify Project read access and record the registry decision — [GitHub Issue #61](https://github.com/blcktgr73/Weaver/issues/61)
- `TASK-030` Define and validate the fabric registry — [GitHub Issue #62](https://github.com/blcktgr73/Weaver/issues/62)
- `TASK-031` Read all items of the central Project — [GitHub Issue #63](https://github.com/blcktgr73/Weaver/issues/63)
- `TASK-032` Show the Overview Kanban — [GitHub Issue #64](https://github.com/blcktgr73/Weaver/issues/64)
- `TASK-033` Open the task, requirement, Issue, pull request, and repository from a card — [GitHub Issue #65](https://github.com/blcktgr73/Weaver/issues/65)
- `TASK-034` Set a fabric root folder and clone the missing repositories — [GitHub Issue #66](https://github.com/blcktgr73/Weaver/issues/66)
- `TASK-035` List mismatches between files, Issues, and the Project — [GitHub Issue #67](https://github.com/blcktgr73/Weaver/issues/67)
- `TASK-036` Mark stale cards — [GitHub Issue #68](https://github.com/blcktgr73/Weaver/issues/68)
- `TASK-037` Show a read-only board when GitHub is unreachable — [GitHub Issue #69](https://github.com/blcktgr73/Weaver/issues/69)
- `TASK-038` Write the guide for registering your own Project — [GitHub Issue #70](https://github.com/blcktgr73/Weaver/issues/70)
- `TASK-039` Reorder, collapse, hide, and filter lanes — [GitHub Issue #73](https://github.com/blcktgr73/Weaver/issues/73)
- `TASK-040` Replace the requirement board with a stage summary — [GitHub Issue #81](https://github.com/blcktgr73/Weaver/issues/81)
- `TASK-041` Show the cards of a requirement or task on the Overview — [GitHub Issue #82](https://github.com/blcktgr73/Weaver/issues/82)

- `TASK-042` Show the last read board when GitHub is unreachable — [GitHub Issue #92](https://github.com/blcktgr73/Weaver/issues/92)
- `TASK-050` Open the views a card leads to as new tabs instead of a split — [GitHub Issue #102](https://github.com/blcktgr73/Weaver/issues/102)
- `TASK-055` Show the maintainer's other projects on the Overview — [GitHub Issue #117](https://github.com/blcktgr73/Weaver/issues/117)
- `TASK-057` Read the user configuration and keep the workspace file as an optional shared one — [GitHub Issue #122](https://github.com/blcktgr73/Weaver/issues/122)
- `TASK-058` Discover the Projects of a user and the repositories on a Project — [GitHub Issue #123](https://github.com/blcktgr73/Weaver/issues/123)
- `TASK-059` Set up the configuration from the terminal with weaver init — [GitHub Issue #124](https://github.com/blcktgr73/Weaver/issues/124)
- `TASK-060` Set up the configuration from the editor and show every repository of the Project — [GitHub Issue #125](https://github.com/blcktgr73/Weaver/issues/125)
- `TASK-061` Move the committed registry and roster out of the repository and write the migration note — [GitHub Issue #126](https://github.com/blcktgr73/Weaver/issues/126)

`TASK-029` and `TASK-030` come first, then `TASK-031` and `TASK-032` give the first end-to-end board. `TASK-034` needs only `TASK-030`. The rest follow the board.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
