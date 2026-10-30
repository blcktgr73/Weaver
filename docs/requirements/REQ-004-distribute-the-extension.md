---
id: REQ-004
type: requirement
title: People can install Weaver without building it
status: draft
owner: PALab
story_ids: [US-021]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# People can install Weaver without building it

## Problem

The extension can only be shared as a VSIX file built from a checkout, and the repository has no license. See the [distribution guide](../onboarding/distribution.md).

## Outcome

A new user installs a released Weaver build from a GitHub Release or a registry, under a stated license.

## Acceptance criteria

- The repository has a license, and the VSIX is built with it.
- A tagged release attaches the VSIX to a GitHub Release without manual steps.
- The extension can be found and installed from a registry (Marketplace or Open VSX) by search.
- The distribution guide matches how releases are actually made.

## Tasks

- `TASK-020` Choose and add a license — [GitHub Issue #43](https://github.com/blcktgr73/Weaver/issues/43)
- `TASK-021` Attach the VSIX to a GitHub Release from CI — [GitHub Issue #44](https://github.com/blcktgr73/Weaver/issues/44)
- `TASK-022` Publish to a registry — [GitHub Issue #45](https://github.com/blcktgr73/Weaver/issues/45)

Installing the VSIX in a normal window is still open under `TASK-012`.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
