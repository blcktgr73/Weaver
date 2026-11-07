---
id: REQ-014
type: requirement
title: A folder that holds your projects carries its own Weaver configuration
status: draft
owner: ebrAIn.lab
story_ids: [US-049]
repository: ebrAIn-Lab-3B/Weaver
github_project: ebrAIn.lab Kanban
---

# A folder that holds your projects carries its own Weaver configuration

## Problem

A person works in more than one operating environment: a personal folder of projects and an organization's folder, each with its own Project and repositories. Today Weaver has one personal file ([DEC-014](../decisions/DEC-014-user-configuration.md)) and, inside a workspace, an optional `fabric.yaml`. The folder that holds the clones is known only to the editor (`weaver.fabricRoot`), so the `weaver` tool and an agent cannot tell which environment they are in. A `fabric.yaml` at a repository root works, but this repository keeps none by decision, and a test enforces it.

## Outcome

A folder that holds projects (an operating root, such as `prj` or `ebr_prj`) may carry `.weaver/config.yaml`. Weaver finds the nearest one from where it runs, in the editor and in the terminal, and uses it for the Project and repositories of everything under that folder. Outside any such folder, the personal file applies as before.

## Acceptance criteria

- `<folder>/.weaver/config.yaml` holds `project`, `repositories`, and `roster` with the same meaning as in the personal file. It is not committed by Weaver.
- Weaver finds the file by walking up from the folder it runs in (`--root` or the current folder for the tool, the first workspace folder for the editor); the nearest file wins. The personal folder itself is skipped.
- The order is: the workspace `fabric.yaml`, the nearest root file, the personal file. The winning file decides `project` and `repositories` as a whole; a missing `repositories` means every repository on the Project and does not borrow another file's list.
- The roster is layered: a referenced roster ([DEC-017](../decisions/DEC-017-shared-roster-by-reference.md)), then the root file, then the personal file on top. A reference in a repository's `process.yaml` wins over one in the root file, which wins over one in the personal file.
- A root file does not carry process settings. A `columns`, `evidence`, `stale`, or `task` section there is reported and not applied, because the repository is the single source of truth for its process ([DEC-015](../decisions/DEC-015-process-configuration.md)).
- When a root file is found, its folder is the default clone folder; an explicit `weaver.fabricRoot` wins.
- The Overview and the tool say which file decided, with its path.
- `weaver init --root <folder>` and the editor's setup can write a root file, showing it first and asking before writing ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)).
- A repository named in `repositories` that has no card on the Project is shown with a visible note instead of being dropped, and the person can add it to the list. Repositories found as clones under the root count as named. (From proposal [#189](https://github.com/ebrAIn-Lab-3B/Weaver/issues/189).)
- The repository list found on the Project is saved with the time it was read, in the personal folder and never in a repository. The picker opens from it and refreshes on a command and when it is old.
- Nothing in code, schema, or tests assumes a folder name such as `prj` or `ebr_prj`. A guide and a commented sample show the file.

## Open decisions

Recorded in [DEC-018](../decisions/DEC-018-operating-root-configuration.md): the saved list is fresh for 24 hours and is read again in the background after that (item 12); a root folder may be a Git repository and Weaver says once that the file is personal (item 13); the file that decided is always shown (item 9). Still open there: whether the background refresh is silent in the first version.

## Tasks

- `TASK-077` Decide the operating root configuration — [GitHub Issue #196](https://github.com/ebrAIn-Lab-3B/Weaver/issues/196)
- `TASK-078` Read the operating root configuration — [GitHub Issue #199](https://github.com/ebrAIn-Lab-3B/Weaver/issues/199)
- `TASK-079` Name the file that decided and where each roster entry comes from — [GitHub Issue #202](https://github.com/ebrAIn-Lab-3B/Weaver/issues/202)
- `TASK-080` Use the root file in the editor and as the clone folder — [GitHub Issue #205](https://github.com/ebrAIn-Lab-3B/Weaver/issues/205)
- `TASK-081` Write a root file from the tool and the editor setup — [GitHub Issue #208](https://github.com/ebrAIn-Lab-3B/Weaver/issues/208)
- `TASK-082` Show repositories without cards and keep the repository list — [GitHub Issue #212](https://github.com/ebrAIn-Lab-3B/Weaver/issues/212)

Origin: the maintainer, 2026-11-07, after moving this repository to an organization and keeping a personal and an organization environment side by side. Absorbs proposal [#189](https://github.com/ebrAIn-Lab-3B/Weaver/issues/189).

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
