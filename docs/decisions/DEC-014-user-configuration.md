# DEC-014: Which Project and repositories a person sees is personal configuration, kept outside the repository

- Status: accepted
- Date: 2026-11-01
- Related: `REQ-006`, `REQ-002`, supersedes [DEC-010](./DEC-010-fabric-registry-location.md), amends [DEC-007](./DEC-007-central-project-is-configuration.md), `TASK-057` to `TASK-061`

## Context

[DEC-010](./DEC-010-fabric-registry-location.md) put the registry, `fabric.yaml`, in the repository, so every user saw the same list. The first dogfooding showed that this is wrong: the repositories a person wants on the Overview are that person's own choice, and a personal list should not enter the history of a shared repository. The contributor roster has the same nature.

## Decision

1. **One personal file.** The configuration is `~/.weaver/config.yaml` (the folder can be moved with the environment variable `WEAVER_HOME`, which the action log already uses). The editor and the `weaver` tool read the same file. Nothing in it is committed to a repository.
2. **What it holds.**
   - `project`: the central Project, `owner` and `number` ([DEC-007](./DEC-007-central-project-is-configuration.md)).
   - `repositories`: optional. Each entry is `owner/name` or `{repository, title?}`. When it is left out, every repository that has cards on the Project is a lane, and a person hides the ones they do not want. When it is given, only those repositories are shown, in that order.
   - `roster`: optional. The contributors that tasks can be given to ([DEC-013](./DEC-013-contributor-roster.md) describes the entries). There is no `roster.yaml`.
3. **A shared file is still possible, but optional.** A workspace may keep a `fabric.yaml` (the registry format of DEC-010) at its root for a team that wants everyone to see the same Project and repositories. When it exists it decides `project` and `repositories` for that workspace; the roster always comes from the personal file. No Weaver repository file is required for Weaver to work.
4. **Where the configuration comes from, in order.** The workspace `fabric.yaml`, then the personal `config.yaml`. With neither, the Overview and the tool say how to set it up.
5. **Setup is a procedure, not a file to write by hand.** The editor command "Weaver: Set Up" and `weaver init` do the same steps: confirm the GitHub sign-in, list the Projects of the person and their organizations, take the repositories found on the chosen Project (the person unticks the ones to leave out), offer the assignees found on its cards as roster candidates (agents are added by hand), optionally set the clone folder, and write the file, telling where it is. The file can be edited by hand afterwards.
6. **The Overview does not open by itself in every window.** It opens from a command and a status bar entry. A workspace that has a `fabric.yaml` may still open it on start, as before.

## Reasons

- The Project is the shared thing, and it lives on GitHub. What a person looks at is a view of it.
- A home file works for both the editor and the terminal, so an agent and a person see the same board.
- Deriving the repositories from the Project removes a registration step and cannot drift from the Project.

## Consequences

- The committed `fabric.yaml` of this repository and the `roster.yaml` that was proposed are not used. `TASK-061` moves them out and writes the migration note.
- [REQ-006](../requirements/REQ-006-overview-kanban-across-repositories.md) AC-001 says so.
- The Requirement view's owner picker (`TASK-013`) reads the roster from the personal file.
- Reading a Project without a repository list needs the reader to accept every Issue it finds (`TASK-058`, `TASK-057`).

## Not decided yet

- A roster per repository, for a person who works with different teams.
- Reading the personal configuration from a remote place (for a new machine).
