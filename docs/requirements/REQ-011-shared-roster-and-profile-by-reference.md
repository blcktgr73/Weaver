---
id: REQ-011
type: requirement
title: A shared roster and process profile are read from a reference
status: draft
owner: PALab
story_ids: [US-044]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# A shared roster and process profile are read from a reference

## Problem

[DEC-013](../decisions/DEC-013-contributor-roster.md) keeps the roster in a person's own `~/.weaver/config.yaml`. An organization that runs several agents keeps their definitions in one repository, and each person copying them by hand drifts from the original. Weaver also must not take on the organization's policy, so it cannot own that original.

## Outcome

An organization keeps the roster and the process profile in its own repository. Weaver reads them by reference and caches them, never copies them, and never reads the instance settings of an agent.

## Acceptance criteria

- The roster has three layers: party (`id`, `kind`, `tool`, `model`), role (free strings), and reach (a generic `{type, value}`, for example a label to apply).
- Weaver reads the roster from a reference (repository, path, ref), caches it on the person's computer, shows how old the cache is, and works from the cache when offline.
- Instance settings (nodes, channel ids, tokens) are not part of the schema and are never read.
- A person's own roster ([DEC-013](../decisions/DEC-013-contributor-roster.md)) still works; the rule for combining it with a referenced roster is fixed in a decision.
- The process profile (the task section of [REQ-010](./REQ-010-organization-defined-task-contract.md)) can also come from a reference, and the decision says where the reference is declared.
- Weaver never writes to the referenced repository. A change to the original goes through review in the repository that owns it.

## Tasks

- `TASK-069` Decide the roster schema and the reference mechanism — [GitHub Issue #167](https://github.com/blcktgr73/Weaver/issues/167)
- `TASK-070` Read the roster and the profile from a reference with a cache — [GitHub Issue #168](https://github.com/blcktgr73/Weaver/issues/168)

Origin: proposal [#161](https://github.com/blcktgr73/Weaver/issues/161). The shape is decided in the first task of each requirement before any code follows it.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
