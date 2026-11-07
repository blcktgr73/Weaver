---
id: REQ-015
type: requirement
title: Weaver works under several operating guidelines at once
status: draft
owner: ebrAIn.lab
story_ids: [US-050]
repository: ebrAIn-Lab-3B/Weaver
github_project: ebrAIn.lab Kanban
---

# Weaver works under several operating guidelines at once

## Problem

An organization has an operating guideline: how it names the steps from intent to code, how it runs agents, what it checks. One guideline in use is `agentic-base` (a Story Chain with its own levels and a Mission Control). Another organization has another. Weaver must carry out whichever applies and know none by name ([independence principle](../../AGENTS.md)). Today an organization can state task fields ([DEC-016](../decisions/DEC-016-task-contract-in-process-file.md)) and a roster ([DEC-017](../decisions/DEC-017-shared-roster-by-reference.md)), but not which guideline it follows, and Weaver fixes the names `US`, `REQ`, and `TASK`. A repository with no process file shows a gap on every card until someone writes one.

## Outcome

A guideline is a repository or a folder the organization owns, and a root folder ([REQ-014](./REQ-014-operating-root-configuration.md)) or a repository says which one applies. Weaver reads it by reference, offers a starting process file from it, and shows repositories under different guidelines side by side without one's rules leaking into another.

## Acceptance criteria

- A guideline is referenced by `{repository, path, ref}` as in [DEC-017](../decisions/DEC-017-shared-roster-by-reference.md), declared in a root file or in a repository's `process.yaml`. Weaver reads and caches it and never writes to it.
- Which guideline applies to a repository: the reference in its `process.yaml`, then the one in the nearest root file, then none. The Overview and the tool show which.
- When a repository has no process file, Weaver offers one, shows the exact file, and writes it only after a yes ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)). It starts from the guideline when there is one. Without a guideline it looks at how the repository is tracked (status labels, or the board Status) and offers the matching defaults. (From proposal [#173](https://github.com/ebrAIn-Lab-3B/Weaver/issues/173).)
- Two repositories under different guidelines appear on one Overview, each judged by its own rules.
- The first task records whether a guideline must also name the levels between a story and a task (the pattern of the IDs and the folder of each level), using the Story Chain of `agentic-base` as the test case, and decides what is built. If levels are needed, a later decision adds them.
- No guideline's name or vocabulary appears in code, schema, or tests. `agentic-base` appears only as a worked example in the documents.
- The guideline repository can describe itself for Weaver with a `.weaver` folder. That change is made by a pull request in that repository, not here.

## Open decisions

- Whether levels are configurable (see above), or a guideline's own levels stay outside Weaver and only link to its requirements and tasks.
- How a guideline and a repository's own `process.yaml` combine when both set a value ([DEC-015](../decisions/DEC-015-process-configuration.md) says the repository wins).

## Tasks

- `TASK-084` Decide how an operating guideline is referenced and offered — [GitHub Issue #218](https://github.com/ebrAIn-Lab-3B/Weaver/issues/218)

Tasks are listed here once the open decisions are recorded.

Origin: the maintainer, 2026-11-07: ebrAIn.lab keeps its operating guideline in `agentic-base`, and Weaver should handle several guidelines. Absorbs proposal [#173](https://github.com/ebrAIn-Lab-3B/Weaver/issues/173).

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
