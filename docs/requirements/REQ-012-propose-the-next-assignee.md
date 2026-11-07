---
id: REQ-012
type: requirement
title: Weaver proposes who takes a card next
status: draft
owner: PALab
story_ids: [US-045]
repository: ebrAIn-Lab-3B/Weaver
github_project: PALab Ops Kanban
---

# Weaver proposes who takes a card next

## Problem

When a card changes state, someone must decide who takes it next. In an agent team that decision is spread over several bots and a person, and it is not visible where it is made. Automating it without a single decider per state risks loops and duplicate work.

## Outcome

Each state has one declared decider. Weaver shows who holds a card and who should take it next, proposes the change for confirmation, and surfaces the cards that need a person. Automatic assignment waits until its prerequisites are settled.

## Acceptance criteria

- For each state, exactly one decider (a person, an agent, or a rule) is declared, and Weaver shows it on the card.
- Weaver shows, without writing, who holds a card and who should take it next, from the roster roles and the card fields.
- Weaver proposes the next assignee and label, and applies it only after the person confirms ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md), [DEC-012](../decisions/DEC-012-steward-first-version.md)).
- Cards that need a person (for example `gated` or a human decision) are surfaced for that person.
- Automatic application is out of scope until bot identity, a hop limit, and coordination with the existing claim lock are settled.

## Tasks

- `TASK-071` Show the decider and propose the next assignee — [GitHub Issue #169](https://github.com/ebrAIn-Lab-3B/Weaver/issues/169)
- `TASK-072` Settle the prerequisites for automatic assignment — [GitHub Issue #170](https://github.com/ebrAIn-Lab-3B/Weaver/issues/170)

Origin: proposal [#162](https://github.com/ebrAIn-Lab-3B/Weaver/issues/162). The shape is decided in the first task of each requirement before any code follows it.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
