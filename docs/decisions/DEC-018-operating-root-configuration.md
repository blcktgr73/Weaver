# DEC-018: A folder that holds projects carries its own configuration, found by walking up from where Weaver runs

- Status: proposed on 2026-11-07; it becomes accepted when the maintainer merges the pull request that adds it
- Date: 2026-11-07
- Related: `REQ-014`, `TASK-077`, proposal [#189](https://github.com/ebrAIn-Lab-3B/Weaver/issues/189), amends [DEC-014](./DEC-014-user-configuration.md) item 4, builds on [DEC-015](./DEC-015-process-configuration.md) and [DEC-017](./DEC-017-shared-roster-by-reference.md), keeps [DEC-007](./DEC-007-central-project-is-configuration.md) and [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md)

## Context

[DEC-014](./DEC-014-user-configuration.md) gives a person one file, `~/.weaver/config.yaml`, and lets a workspace keep an optional `fabric.yaml`. A person who works in a personal folder of projects and in an organization's folder wants each folder to show its own Project and repositories. The folder that holds the clones is known only to the editor (`weaver.fabricRoot`), so the `weaver` tool and an agent cannot tell which environment they are in. A `fabric.yaml` at a repository root works, but this repository keeps none by decision and a test enforces it.

## Decision

1. **A root file.** A folder (an *operating root*, such as `prj` or `ebr_prj`) may hold `.weaver/config.yaml`. It has the keys of the personal file: `project`, `repositories`, `roster`. It is a local file; Weaver never commits it and never writes it without confirmation ([DEC-008](./DEC-008-agent-identity-and-write-confirmation.md)).
2. **Finding it.** Weaver starts at the folder it runs in (`--root` or the current folder for the tool, the first workspace folder for the editor) and walks up through the parent folders until one holds `.weaver/config.yaml`. The nearest file wins. The walk ends at the top of the file system.
3. **The personal folder is skipped.** The folder of the personal file (`~/.weaver`, or `WEAVER_HOME`) is not taken as a root file, compared by its resolved path. It is the last layer already; counting it again would name the wrong file as the one that decided and would stack the roster twice. When no root file is found, the personal file applies, as today.
4. **Order.** The workspace `fabric.yaml`, then the nearest root file, then the personal file ([DEC-014](./DEC-014-user-configuration.md) item 4, amended). The winning file decides `project` and `repositories` as a whole: a root file with no `repositories` means every repository on its Project, and does not take the list of another file.
5. **Which reference applies.** For a roster or a guideline reference ([DEC-017](./DEC-017-shared-roster-by-reference.md), `REQ-015`), the first declared wins: the repository's `process.yaml`, then the root file, then the personal file. This extends [DEC-017](./DEC-017-shared-roster-by-reference.md) item 5.
6. **Roster values.** *(Decision point for the maintainer.)* When the same contributor `id` appears in more than one layer, the layers are stacked as [DEC-017](./DEC-017-shared-roster-by-reference.md) item 6 stacks a personal roster on a referenced one: the referenced roster is the base, the root file's entries are laid over it, and the personal file's entries over those. A field set in a later layer replaces the earlier one; a layer never removes a contributor of an earlier one. Where each field comes from is shown. The other reading, an organization's list overriding a person's, would change [DEC-017](./DEC-017-shared-roster-by-reference.md) and is not taken here.
7. **No process in a root file.** A `columns`, `evidence`, `stale`, `task`, or `version` section in a root file is reported as a warning and not applied. The repository is the single source of truth for its process ([DEC-015](./DEC-015-process-configuration.md) item 2). A starting process file comes from a guideline (`REQ-015`), not from a root file.
8. **The clone folder.** When a root file is found, its folder is the default folder that holds the clones. An explicit `weaver.fabricRoot` wins. A clone goes to `<folder>/<repository name>`.
9. **Always say which file decided.** The Overview and the tool show the path of the file that decided `project` and `repositories`, and the path of each layer that added to the roster. A file outside the opened folder that changes which Project is read is never silent.
10. **Writing a root file.** `weaver init --root <folder>` and the editor's setup write `<folder>/.weaver/config.yaml` the way they write the personal file: show it, ask, keep the old one as `config.yaml.bak`.
11. **Repositories without cards.** A repository that is named in `repositories`, or found as a clone under the root, and has no card on the Project is shown as a lane with a note instead of being dropped, and the person may add it to the list (proposal [#189](https://github.com/ebrAIn-Lab-3B/Weaver/issues/189)). Nothing is added to the Project or to a file without a yes.
12. **A saved repository list.** The repositories found on the Project are saved with the time they were read, in the personal folder, never in a repository. The picker opens from the saved list at once. A list older than 24 hours is read again in the background and the view draws again only if it changed; a command reads it again at any time. The age is shown.
13. **A root folder that is a Git repository.** It is allowed. Weaver says once, when it finds the file there, that the file is personal and should not be committed.
14. **No folder name in the code.** Nothing in code, schema, or tests assumes `prj`, `ebr_prj`, or any name; a root is whatever folder holds a `.weaver/config.yaml`.

## Reasons

- The folder a person works in is the natural place to say which environment it is. Walking up is how a person already finds a repository's root.
- One file format for the personal file and the root file means one reader, one setup, and one sample.
- Keeping process out of the root file keeps [DEC-015](./DEC-015-process-configuration.md): everyone who reads a repository sees the same board.
- Showing the deciding file makes a parent folder's influence visible, which is the only real risk of walking up.

## Consequences

- `loadConfig` in the markdown package takes the folder it runs in and returns which file decided; the tool and the editor use the same function.
- The `fabric.yaml` test of this repository stays as it is; a person's configuration lives outside the repository.
- `TASK-078` and later tasks implement items 2 to 12; a guide and a commented sample ship with them.
- `REQ-015` adds the guideline reference to item 5 without changing this decision.

## Not decided yet

- Whether a refresh in the background is silent in the first version; the age is shown either way.
- Reading a root file from a remote place, for a new machine.
