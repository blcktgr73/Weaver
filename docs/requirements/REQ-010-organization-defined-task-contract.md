---
id: REQ-010
type: requirement
title: An organization defines its own task contract
status: draft
owner: PALab
story_ids: [US-043]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# An organization defines its own task contract

## Problem

`weaver task create` makes an Issue with only the `task` and `status:backlog` labels. A team that runs agents on a card contract (for example Owner, Type, Priority, Blocker, Human required, Related thread) cannot let an agent pick the card up until a person fills the contract in. The contract differs between organizations, so Weaver must not hard-code any one of them ([DEC-007](../decisions/DEC-007-central-project-is-configuration.md)).

## Outcome

An organization declares the fields its tasks must carry, and where each field lives, in `.weaver/process.yaml`. Weaver creates, shows, and reconciles tasks by that declaration, and behaves as it does today when the section is absent.

## Acceptance criteria

- An organization can declare task fields (name, required or not, allowed values) and a body section template in `.weaver/process.yaml`.
- Each field says whether it lives in the task file or on the board (`source: file | project`, default `file`) and maps to an Issue label or a Project field.
- `weaver task create` fills the declared fields and shows them in the plan for confirmation.
- `reconcile` reports a difference between a file field and its board projection.
- Whether a task needs a file at all is configuration, so a light card (an Issue only) is not a gap when the process allows it.
- A violation is a gap, never an error. Without the section, behavior is unchanged.
- `AGENTS.md` states that Weaver core never depends on an organization's policy, and that PALab's contract is one example profile.
- Messages are in the catalog in English and Korean.

## Decisions taken

- [DEC-016](../decisions/DEC-016-task-contract-in-process-file.md) (proposed) fixes the shape of the `task` section, the `source: file | project` rule, the mapping to a label or a Project field, light cards, and the gap kinds. `AGENTS.md` now states the independence principle.

## Tasks

- `TASK-065` Decide the task section of the process file and state the independence principle — [GitHub Issue #163](https://github.com/blcktgr73/Weaver/issues/163)
- `TASK-066` Read the task section and fill it in on task create — [GitHub Issue #164](https://github.com/blcktgr73/Weaver/issues/164)
- `TASK-067` Reconcile declared fields and allow light cards — [GitHub Issue #165](https://github.com/blcktgr73/Weaver/issues/165)
- `TASK-068` Add messages and a worked example for the task contract — [GitHub Issue #166](https://github.com/blcktgr73/Weaver/issues/166)

Origin: proposal [#160](https://github.com/blcktgr73/Weaver/issues/160). The shape is decided in the first task of each requirement before any code follows it.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
