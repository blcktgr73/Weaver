# DEC-017: The roster is a contract Weaver owns and an organization provides, read by reference

- Status: proposed on 2026-11-05; it becomes accepted when the maintainer merges the pull request that adds it
- Date: 2026-11-05
- Related: `REQ-011`, `TASK-069`, `TASK-070`, proposal [#161](https://github.com/ebrAIn-Lab-3B/Weaver/issues/161), amends [DEC-013](./DEC-013-contributor-roster.md), builds on [DEC-014](./DEC-014-user-configuration.md) and [DEC-015](./DEC-015-process-configuration.md), keeps [DEC-007](./DEC-007-central-project-is-configuration.md) and [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md)

## Context

[DEC-013](./DEC-013-contributor-roster.md) keeps the roster in a person's own `~/.weaver/config.yaml`. That fits one person, but not an organization whose agents run on several nodes: every person would hold a copy that drifts from the original. Weaver must know which contributors it can give work to, but it must not learn how an organization runs them (node addresses, chat ids, tokens), and it must not own the organization's list.

The same question holds for the process profile, the `task` section that [REQ-010](../requirements/REQ-010-organization-defined-task-contract.md) adds to `.weaver/process.yaml`: an organization with many repositories wants to write it once.

## Decision

1. **Dependency inversion.** Weaver owns the schema of the roster (item 2). An organization provides a file that follows it, in a repository it owns. Weaver reads that file by reference and never writes to it. A change to the original is a pull request in the repository that owns it.
2. **Three layers.** An entry of `contributors` has:
   - *Party* (who): `id` (the name task files use), `kind` (`human` or `agent`), and optional `name`, `github`, `tool`, `model`. These are the fields of [DEC-013](./DEC-013-contributor-roster.md) item 2, unchanged.
   - *Role* (what it can take): `roles`, a list of plain strings. Weaver matches a task or a rule to a role. What a role means is the organization's policy; Weaver does not interpret the strings and defines none.
   - *Reach* (how work gets to it): `reach`, one entry or a list of entries of the form `{type, value}`. The only `type` Weaver acts on is `label` (the value is a label added to the Issue). Any other `type` is kept and shown but not acted on, so Weaver learns no one router. A plain string, the form DEC-013 allowed, is read as `{type: text, value: <the string>}`: a description for a person, never acted on.
3. **Not in the schema.** Instance details (node addresses, channel ids, tokens, credentials) are not part of the roster. A field that is not in the schema is kept in the file, ignored by Weaver, and reported as a warning, so that a secret put there by mistake is noticed. Weaver never reads or sends such a field.
4. **A reference.** A reference is `{repository, path, ref}`. `repository` is `owner/name`, `path` is a file in it, and `ref` is a branch, tag, or commit, and defaults to the default branch of that repository.
5. **Where a reference is declared.**
   - *The roster* is declared in the `process.yaml` of the repository whose work it serves (`roster: {from: {repository, path, ref}}`), because an organization states its contributors once for all its repositories and everyone who reads the repository then sees the same roster. A person who reads repositories that have no such declaration may declare one reference in the personal configuration (`roster.from`); a reference in `process.yaml` wins over it.
   - *The task profile* (the `task` section of REQ-010) is declared only in `process.yaml` (`task: {from: {repository, path, ref}}`, or the section written in place). The process belongs to the repository and has no personal override ([DEC-015](./DEC-015-process-configuration.md) item 2). When both a section written in place and a reference are given, the section written in place wins field by field.
6. **Combining with the personal roster.** A person's own `roster.contributors` ([DEC-013](./DEC-013-contributor-roster.md)) is an overlay on the referenced roster:
   - An id that is in both (matched without regard to case) takes the fields the personal entry sets; the fields it leaves out come from the reference. `roles` and `reach` in the personal entry replace the referenced ones as a whole.
   - An id only in the personal roster is added.
   - A personal roster never removes a referenced contributor.
   - Where a field comes from (reference or personal) is shown, so a difference is visible and not hidden. With no reference, the personal roster works as it does today.
7. **Reading.** The file is read through GitHub (`GET /repos/{owner}/{name}/contents/{path}?ref={ref}`) with the person's token, the way `process.yaml` is read ([DEC-015](./DEC-015-process-configuration.md) item 9):
   - The last text is kept on the person's computer, never in a repository, with its `ETag`. A view draws from the cache at once, asks GitHub with a conditional request in the background, and draws again only when the file changed.
   - The view shows how old the cached roster is.
   - With no network, or no access to the repository, the cache is used. With no cache either, there is no roster: nothing judges an owner, and the view says why. This is a gap, not an error.
   - A file that is missing, cannot be read, or has an invalid entry gives gaps and warnings. An invalid entry is left out and the others still apply. Nothing stops Weaver from working.
8. **Humans and collaborators.** The humans of a roster may later be taken from the collaborators of the repository ([DEC-014](./DEC-014-user-configuration.md), not decided yet). In this decision, only a check is specified: Weaver lists the ids and logins of the roster that do not match the collaborators of the repository, as a gap. It changes nothing.
9. **What is validated against it.** Unchanged from [DEC-013](./DEC-013-contributor-roster.md) item 4: an owner, reviewer, or approver that is not in the roster, an approver that is an agent, and agent work that is Verified with no human approval are gaps. The actor of the action log is also checked against the roster as a gap.
10. **No organization in the code.** No runtime detail of any one organization appears in Weaver code, in the schema, or in its examples. PALab's roster is one example organization, kept in its own repository.

## Reasons

- The organization owns who its agents are and how they are reached; Weaver owns only the shape in which it asks for them. Neither needs to know the other's internals.
- A reference, not a copy, removes the drift. A cache, as for `process.yaml`, keeps the editor fast and usable offline.
- `{type, value}` with one acted-on type keeps Weaver from learning any one router, and the same shape carries the question of the agent handoff ([TASK-016](../tasks/TASK-016.md)).
- Declaring the reference in `process.yaml` follows the rule that a repository is the single source of truth for how its work is tracked; the personal overlay of the roster is fine because the roster, unlike the process, is also a personal list.

## Consequences

- [DEC-013](./DEC-013-contributor-roster.md) item 1 (location) and item 2 (shape) are amended by this record; its items 3 to 5 stand.
- The [artifact schema](../product/artifact-schema-v0.1.md) documents the three layers and the reference.
- `TASK-070` reads the roster and the profile from a reference with the cache, shows the age, adds the collaborator check, and keeps the warning for fields outside the schema.
- The `reach` of an existing personal roster, a string, keeps working as `{type: text, value}`.
- `process.yaml` version 1 gains the `roster.from` and `task.from` entries; that is added to the shape of [DEC-015](./DEC-015-process-configuration.md) by `TASK-065` and `TASK-070`, with no change to a file that does not use them.

## Not decided yet

- The format of a `type` other than `label` (for example a comment or a webhook). Weaver acts on none today.
- Whether a role may carry a rule of its own (for example "a Review card goes to the role `reviewer`"). That belongs to [REQ-012](../requirements/REQ-012-propose-the-next-assignee.md).
- Reading the roster of a private repository that the person's token cannot read: it is a gap now, and no other way of reading is added.
