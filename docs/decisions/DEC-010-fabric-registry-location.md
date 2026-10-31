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

## Access to the Project (TASK-029)

Reading and writing the central Project reuses the logins that already exist. No new token type is introduced.

1. **Command line and agents** use the `gh` login (see [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md)). Checked on 2026-10-31: a classic token with the `repo` and `project` scopes reads PALab Ops Kanban, a personal Project. It returned 108 items from 14 repositories, in pages of at most 100, so reading must follow the next-page cursor.
2. **The VS Code extension** uses VS Code's own GitHub sign-in, as it does today (`repo`, plus `project` when a Project is read or a card moves). Whether that sign-in can read every item of a Project is confirmed by `TASK-031`.
3. **Fine-grained tokens are not relied on.** They were not tested. A personal Project may not accept them, and this decision does not need them.
4. **Organization Projects** are not tested yet. The guide says so until someone verifies one.
5. A Project may hold items from repositories that are not registered. The Overview shows only the registered ones.
6. Without the `project` scope, Weaver still shows the repository and Issue view and says that the Project is unavailable ([DEC-007](./DEC-007-central-project-is-configuration.md)).

## Not decided yet

- Whether VS Code's sign-in reads a whole Project (`TASK-031`).
- How an organization Project behaves.
