---
id: REQ-017
type: requirement
title: A card is moved between columns by dragging it
status: draft
owner: ebrAIn.lab
story_ids: [US-052]
repository: ebrAIn-Lab-3B/Weaver
github_project: ebrAIn.lab Kanban
---

# A card is moved between columns by dragging it

## Problem

A card moves between columns only through a command or the Requirement view. People expect to drag a card on a Kanban. It is not known whether dragging works inside a VS Code webview, and a drop must not skip the confirmation and the evidence rules that every move follows.

## Outcome

A person drags a card to a column on the Overview. The drop opens the same plan and confirmation as `weaver card move`. Where the extension cannot do it, the requirement moves to the application implementation.

## Acceptance criteria

- A small prototype shows whether dragging a card works in the Overview webview of VS Code 1.90 and later. The result is recorded in a decision.
- If it works, a drop on a column shows the plan of `weaver card move` and moves the card only after the person confirms ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)). A move to Verified is refused when there is no evidence, as today.
- A drop on a column that the repository's process cannot express ([DEC-015](../decisions/DEC-015-process-configuration.md)) is refused with the reason.
- A keyboard way to do the same move exists, so the board does not need a mouse.
- If it does not work in the extension, the decision says so and this requirement is carried to the application implementation with the same criteria.

## Open decisions

- Whether the card shows its new column while waiting for the confirmation, or stays until it is confirmed.

## Tasks

Tasks are listed here once the open decisions are recorded.

Origin: the maintainer, 2026-11-07.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
