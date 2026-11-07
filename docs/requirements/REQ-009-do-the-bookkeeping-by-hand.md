---
id: REQ-009
type: requirement
title: Everything the steward does can also be done by hand in the editor, and every card says why
status: draft
owner: PALab
story_ids: [US-038, US-039, US-040, US-041]
repository: ebrAIn-Lab-3B/Weaver
github_project: PALab Ops Kanban
---

# Everything the steward does can also be done by hand in the editor, and every card says why

## Problem

Friction found on 2026-11-02 while reviewing tasks in the Overview: most corrections needed an agent or the command line. Changing a status label, splitting a task, and writing progress notes could not be done from the editor. A new task came out with an empty description. A card in Review gave no readable reason (for example `gap.closed-without-verified` for a closed Issue that kept `status:backlog`). The steward of [REQ-007](./REQ-007-steward-agent-for-the-kanban.md) is meant to save effort, but a person who cannot do the same step by hand depends on it.

## Outcome

Each routine step that the `weaver` tool offers can also be done by a person in the editor, with the same plan and the same confirmation. Each card says in plain words why it is in its column and what to do next.

## Acceptance criteria

- From the Overview, a person can see the plan of fixes that `reconcile` reports and approve them one by one. The editor calls the same logic as the command-line tool.
- A person can create a task from the editor with a title, a description, and an owner. The task file, the Issue, and the Project card are made together, and the description is not left empty.
- A person can add a progress note or a decision to a task file from the Requirement view, and it is written to the file in the repository.
- A card shows in the user's language why it is in its column and what would change it. A gap is described in words, not by its code.
- Nothing changes before the person confirms the exact change.
- Every user-facing message for this feature is in the message catalog in English and Korean.

## Open decisions

- Whether approving many fixes at once is allowed, or each one is confirmed alone as in [DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md).
- Where a progress note is written: the task file only, or also an Issue comment.

## Tasks

Tasks are listed here once the open decisions are recorded.
