# DEC-019: An operating guideline is a repository Weaver reads by reference and offers a starting process file from

- Status: proposed on 2026-11-08; it becomes accepted when the maintainer merges the pull request that adds it
- Date: 2026-11-08
- Related: `REQ-015`, `TASK-084`, proposal [#173](https://github.com/ebrAIn-Lab-3B/Weaver/issues/173), builds on [DEC-015](./DEC-015-process-configuration.md), [DEC-017](./DEC-017-shared-roster-by-reference.md), and [DEC-018](./DEC-018-operating-root-configuration.md), keeps [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md)

## Context

An organization has an operating guideline: how it names the steps from intent to code, how it runs agents, what it checks. `agentic-base` is one. It has its own levels (Experience, Moment, Promise, Aspect, Evidence Ledger), its own validators and a Mission Control that enforce the links between them, and its own queue (`fix_plan.md`). Another organization has another. Weaver must carry out whichever applies and know none by name (the independence principle in `AGENTS.md`).

Weaver already reads an organization's roster and task profile by reference ([DEC-017](./DEC-017-shared-roster-by-reference.md)), a repository's process from its own file ([DEC-015](./DEC-015-process-configuration.md)), and Project and repositories from a root file ([DEC-018](./DEC-018-operating-root-configuration.md)). Two things are missing: a way to say which guideline applies, and what to do when a repository has no process file. Without a file every card of a repository that does not use `status:*` labels shows a gap, until someone writes one (proposal [#173](https://github.com/ebrAIn-Lab-3B/Weaver/issues/173)).

The open question of `REQ-015` is whether a guideline must also name the levels between a story and a task. The test case is the Story Chain of `agentic-base`.

## Decision

1. **A guideline is a repository, or a folder in one, that an organization owns.** Weaver reads it and never writes to it. A change to a guideline is a pull request in the repository that owns it.
2. **A guideline provides a starting process file.** It is an ordinary process file in the format of [DEC-015](./DEC-015-process-configuration.md), at the path the reference names (default `.weaver/process.yaml`). It may also carry the `roster` reference and the `task` section that [DEC-017](./DEC-017-shared-roster-by-reference.md) allows in a process file. Weaver defines nothing else a guideline must hold.
3. **A reference.** `guideline: {repository, path, ref}`, with the same three fields and the same defaults as the references of [DEC-017](./DEC-017-shared-roster-by-reference.md) item 4: `repository` is `owner/name`, `path` is the folder or file in it (default `.weaver/process.yaml`), `ref` is a branch, tag, or commit (default the default branch).
4. **Where it is declared, and which wins.** The first declared wins, as for a roster reference ([DEC-018](./DEC-018-operating-root-configuration.md) item 5): the repository's own `process.yaml`, then the nearest root file, then the personal file. A `process.yaml` may say `guideline:` to record the guideline the repository follows. The Overview and the tool show which guideline applies to a repository, and from which file.
5. **A guideline never overrides a repository.** A repository with a process file is read from that file alone ([DEC-015](./DEC-015-process-configuration.md) item 2). The guideline is used only to start a file for a repository that has none. It is not a fallback that fills in missing fields.
6. **Offering a process file.** When a repository has no process file, Weaver offers one, shows the exact text, and writes it only after a yes ([DEC-008](./DEC-008-agent-identity-and-write-confirmation.md)). The write is a pull request through a separate worktree, as the other changes to repository files are, never a commit to the default branch.
   - With a guideline that applies, the text is the guideline's process file as it is, with a first comment that names the repository, path, and ref it started from.
   - Without a guideline, Weaver looks at how the repository is tracked: if its Issues carry the `status:*` labels, the defaults of [DEC-015](./DEC-015-process-configuration.md); if not, a file whose columns come from the board Status. It offers that file with a first comment that says so. It never guesses beyond these two.
   - A repository that already has an open pull request for the file is not offered another.
7. **A copy, not a link.** After the file is written it belongs to the repository. A later change to the guideline does not change it. Showing the difference between a repository's file and the guideline's is not part of this decision.
8. **Reading.** A guideline file is read through GitHub with the person's token, kept on the person's computer with its `ETag`, drawn from the copy at once, and asked again in the background, as the roster is ([DEC-017](./DEC-017-shared-roster-by-reference.md) item 7). With no network and no copy there is no guideline: Weaver offers the observed defaults and says why.
9. **Levels stay outside Weaver.** Weaver does not make the names, ID patterns, or folders of the levels between a story and a task configurable now. A guideline keeps its own levels, its own validators, and its own tools; Weaver does not read or duplicate them. The link is made where it already exists: a guideline's process file can set the fields of a task ([DEC-016](./DEC-016-task-contract-in-process-file.md)), and a requirement or task can point to the guideline's artifacts as text. If a second guideline needs Weaver to walk its levels, a new decision adds them, with that guideline as its test case.
10. **Several guidelines at once.** Each repository finds its own guideline by item 4 and is judged by its own process file by item 5, so repositories under different guidelines appear on one Overview without one's rules reaching another.
11. **No guideline in the code.** No guideline's name, vocabulary, file names, or levels appear in Weaver's code, schema, or tests. `agentic-base` appears only as a worked example in documents. A guideline describes itself for Weaver by a `.weaver` folder in its own repository, added by a pull request there.

## Reasons

- A guideline that already has validators and tools does not need a second model of its levels in Weaver, and copying one would make Weaver follow it by name.
- Starting a file once, from a place the organization owns, answers the first-day gap of a repository without taking [DEC-015](./DEC-015-process-configuration.md) away: the repository stays the single source of truth for its process.
- A pull request keeps the rule that Weaver never commits to a default branch and gives the repository's team a review of the file.

## Consequences

- The tasks of `REQ-015` that follow: read a guideline by reference with a cache; offer the starting file from the tool and the editor; show which guideline applies; a guide and a sample.
- The root file and the personal file gain an optional `guideline` key; the artifact schema and the guide say so.
- `agentic-base` gets its `.weaver/process.yaml` by a pull request in its own repository. That is outside this repository and is offered to its owners, not made from here.

## Decision points for the maintainer

- **Item 9, levels.** The alternative is to let a guideline name its levels now. It costs a model of levels in Weaver that `agentic-base` already keeps itself, for a second guideline that does not exist yet.
- **Item 7, copy.** The alternative is to keep a repository's file in step with the guideline. It would make the guideline override the repository, which [DEC-015](./DEC-015-process-configuration.md) rules out.

## Not decided yet

- Showing the difference between a repository's file and its guideline's.
- Pointing a requirement or task at a guideline's artifacts with more than text.
