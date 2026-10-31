---
id: REQ-006
type: requirement
title: One Overview Kanban shows all registered repositories and starts every exploration
status: draft
owner: PALab
story_ids: [US-025, US-026, US-029, US-030]
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
- Weaver opens on the Overview Kanban when a fabric is configured. Cards from different repositories sit on the same board and show their repository.
- From a card the user can open the task file, the requirement view, the Issue, the related pull request, and the repository folder.
- Cards that have not moved for a set time, that have no evidence, or that wait for a human decision are marked on the board.
- Weaver lists mismatches between the repository files, the Issues, and the central Project, using these kinds: task file without an Issue, Project card without a task file, broken Issue link, merged pull request not linked to its task, and board status that disagrees with the Issue. This check only reports; it changes nothing.
- When GitHub cannot be reached, Weaver shows a read-only Kanban from the repository files and says that the state is not current.
- A repository can be viewed on the Overview without being opened as its own VS Code folder.
- Every user-facing message for this feature is in the message catalog in English and Korean.

## Open decisions

- **Registry location.** The registry file lives in the Weaver repository at first, or in a separate hub repository.
- **Read access.** Which token scopes are enough to read a personal or an organization Project (see [DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)).

## Decisions taken

- The central Project is configuration. PALab keeps PALab Ops Kanban, and other teams register their own: [DEC-007](../decisions/DEC-007-central-project-is-configuration.md).
- The six columns stay derived from Issue labels, and no custom Project field is required: [DEC-009](../decisions/DEC-009-keep-labels-for-columns.md).

Open decisions are recorded as `DEC-###` documents before the related tasks start.

## Tasks

Tasks are not created yet. They are split from the acceptance criteria once the open decisions above are settled.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
