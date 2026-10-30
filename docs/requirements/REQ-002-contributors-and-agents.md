---
id: REQ-002
type: requirement
title: Humans and agents work on tasks through Weaver
status: draft
owner: PALab
story_ids: [US-016, US-017, US-018, US-019]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# Humans and agents work on tasks through Weaver

## Problem

Owners are typed into task files by hand, there is no list of who can take work, and nothing says who reviewed or approved what an agent did. Work cannot yet be handed to a remote agent such as OpenClaw or Hermes with durable context.

## Outcome

A maintainer can assign a task to a human or an agent, hand it over with its context, and see who implemented, reviewed, and approved it, with the evidence coming back to the task.

## Acceptance criteria

- A maintainer can assign a task to a human or an agent from the Requirement view, and the task file and the GitHub Issue assignee stay in step.
- Contributors are listed in a roster in the repository, with their kind (human or agent) and, for an agent, its tool or model and how it is reached.
- Task owners are chosen from the roster, and an owner missing from the roster is shown as a gap.
- A task can name a reviewer or approver separately from its implementer, and a human approval of agent work is recorded.
- A task can be handed to a remote agent with durable context, and the agent's branch, pull request, and test results come back to the task.
- The handoff contract does not depend on one agent: at least two different agents are tried against it.

## Tasks

- `TASK-013` Assign a task owner from the Requirement view — [GitHub Issue #36](https://github.com/blcktgr73/Weaver/issues/36)
- `TASK-014` Define the contributor roster and pick owners from it — [GitHub Issue #37](https://github.com/blcktgr73/Weaver/issues/37)
- `TASK-015` Record reviewers and human approval of agent work — [GitHub Issue #38](https://github.com/blcktgr73/Weaver/issues/38)
- `TASK-016` Decide the agent handoff contract — [GitHub Issue #39](https://github.com/blcktgr73/Weaver/issues/39)

Tasks that implement the handoff are added after `TASK-016` records the contract decision.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
