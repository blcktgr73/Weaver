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

- A registry file in Git lists the registered repositories and the central Project they report to. Adding a repository to the registry is a normal reviewed change.
- Each user can set a local fabric root folder, which is not shared. A command clones every registered repository that is missing under that folder and skips the ones already there. Opening the fabric root in VS Code shows all of them in one workspace.
- Weaver opens on the Overview Kanban when a fabric is configured. The columns are the Kanban stages and the lanes are the registered repositories, in the order of the registry, so a card shows which project it belongs to.
- A user can reorder, collapse, hide, and filter lanes. These choices are stored on that user's computer and never in the repository. A collapsed lane still shows its card count and its blocked-card count.
- Pressing a card title opens its requirement view scrolled to the task, or the Issue when no requirement file is visible. A right-click menu on a card lists the task file, the requirement source, the Issue, a pull request that refers to it, and the repository folder; a place that cannot open stays in the list with the reason.
- Cards that have not moved for a set time, that have no evidence, or that wait for a human decision are marked on the board.
- Weaver lists mismatches between the repository files, the Issues, and the central Project, using these kinds: task file without an Issue, Issue link that is not an Issue address, task whose Issue is not on the Project, Project card without a task file (for repositories whose files are in the workspace), merged pull request that names a task in its branch or trailing `(TASK-###)` but does not close its Issue (`docs:` pull requests are left out), and board status that disagrees with the label. This check only reports; it changes nothing.
- When GitHub cannot be reached, Weaver shows a read-only Kanban from the repository files and says that the state is not current.
- A repository can be viewed on the Overview without being opened as its own VS Code folder.
- Every user-facing message for this feature is in the message catalog in English and Korean.
- A requirement view does not carry a second Kanban board. It shows one line of stage counts for its tasks, and the Overview is the only board.
- From a requirement view or a task file, an action shows its cards on the Overview: the project is turned on, its lane is unfolded, and the cards of that requirement or task are highlighted.

## Open decisions

- **Registry location.** The registry file lives in the Weaver repository at first, or in a separate hub repository.
- **Read access.** Which token scopes are enough to read a personal or an organization Project (see [DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)).

## Decisions taken

- The central Project is configuration. PALab keeps PALab Ops Kanban, and other teams register their own: [DEC-007](../decisions/DEC-007-central-project-is-configuration.md).
- The registry is `fabric.yaml` at the root of the Weaver repository: [DEC-010](../decisions/DEC-010-fabric-registry-location.md).
- The six columns stay derived from Issue labels, and no custom Project field is required: [DEC-009](../decisions/DEC-009-keep-labels-for-columns.md).

Open decisions are recorded as `DEC-###` documents before the related tasks start.

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

`TASK-029` and `TASK-030` come first, then `TASK-031` and `TASK-032` give the first end-to-end board. `TASK-034` needs only `TASK-030`. The rest follow the board.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
