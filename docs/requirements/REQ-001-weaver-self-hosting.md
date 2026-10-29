---
id: REQ-001
type: requirement
title: Weaver manages its own development flow
status: in-progress
owner: PALab
story_ids: [US-001, US-004, US-007, US-010, US-012]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# Weaver manages its own development flow

## Problem

Weaver's requirements, tasks, implementation, and validation must remain connected while the product is being designed and built. If this connection is not exercised on Weaver itself, the proposed workflow remains theoretical.

## Outcome

PALab contributors can move from a Weaver requirement to an assigned task, implementation evidence, and a verified result without losing the originating context.

## Acceptance criteria

- A requirement is stored as readable Markdown in the repository.
- The requirement decomposes into explicit tasks with stable IDs.
- Each task identifies a human or AI contributor and an owning repository or package.
- Implementation evidence can link a task to a branch, commit, pull request, and test result.
- Missing evidence, blockers, and human decisions remain visible.
- The same artifacts can be inspected through the initial VS Code prototype.

## Tasks

- `TASK-001` Define and validate the repository-native requirement/task shape — [GitHub Issue #1](https://github.com/blcktgr73/Weaver/issues/1)
- `TASK-002` Implement the VS Code workspace scan and requirement opener — [GitHub Issue #2](https://github.com/blcktgr73/Weaver/issues/2)
- `TASK-003` Design the Requirement Canvas and Task Rail interaction — [GitHub Issue #3](https://github.com/blcktgr73/Weaver/issues/3)
- `TASK-004` Link implementation and test evidence back to a task — [GitHub Issue #4](https://github.com/blcktgr73/Weaver/issues/4)
- `TASK-005` Build the first VS Code Kanban projection — [GitHub Issue #5](https://github.com/blcktgr73/Weaver/issues/5)
- `TASK-006` Minimal read-only Requirement view — [GitHub Issue #8](https://github.com/blcktgr73/Weaver/issues/8)
- `TASK-007` Move a task between Kanban columns with explicit confirmation — [GitHub Issue #12](https://github.com/blcktgr73/Weaver/issues/12)

`TASK-005` was split from `TASK-002`; see [DEC-002](../decisions/DEC-002-split-task-002.md).

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
