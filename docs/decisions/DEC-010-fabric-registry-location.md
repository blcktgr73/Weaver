# DEC-010: The fabric registry is `fabric.yaml` at the root of the Weaver repository

- Status: accepted
- Date: 2026-10-31
- Related: `REQ-006`, [DEC-007](./DEC-007-central-project-is-configuration.md), `TASK-029`, `TASK-030`

## Context

[REQ-006](../requirements/REQ-006-overview-kanban-across-repositories.md) needs a shared registry that lists the registered repositories and the central Project. It had two candidate homes: the Weaver repository or a separate hub repository.

## Decision

1. The registry is a file named `fabric.yaml` at the root of the Weaver repository. It holds the central Project (`project: {owner, number}`, see DEC-007) and the list of registered repositories.
2. Another team keeps the same file in its own repository, which follows from DEC-007.
3. The parser takes a file path and does not assume where the file lives, so the registry can move to a hub repository later without changing the format.
4. The file is edited like any other repository file, through a reviewed change.

## Reasons

- A separate hub repository is one more place to create and maintain, and PALab already centers on this repository.
- Git keeps the history of who registered what.

## Not decided yet

- The token scopes needed to read a personal Project. `TASK-029` checks this and records the result as an addition to this record.
