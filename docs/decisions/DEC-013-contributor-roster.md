# DEC-013: The contributor roster is a part of the personal configuration, and task files record reviewer and approval

- Status: proposed
- Date: 2026-11-01
- Related: `REQ-002`, `TASK-013`, `TASK-014`, `TASK-015`, [DEC-005](./DEC-005-task-files.md), [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md), [DEC-014](./DEC-014-user-configuration.md)

## Context

[REQ-002](../requirements/REQ-002-contributors-and-agents.md) asks for a roster of contributors in the repository, owners chosen from it, a reviewer or approver named apart from the implementer, and a human approval recorded for agent work. [DEC-005](./DEC-005-task-files.md) already puts the owner in the task file (`assignee`, `assignee_type`). This record settles where the roster lives, what it holds, and which task fields record review and approval.

## Decision

1. **Location.** The roster is the `roster` entry of the personal configuration `~/.weaver/config.yaml` ([DEC-014](./DEC-014-user-configuration.md)). It is not committed. There is no `roster.yaml`. Without a roster, nothing judges an owner and the owner can be typed by hand.
2. **Shape.** A `roster` mapping with a `contributors` list. Each entry has `id` (the name task files use) and `kind` (`human` or `agent`). Optional: `name`, `github` (the login; for a human it becomes the Issue assignee), and for an agent `tool`, `model`, and `reach` (how it is reached). An agent without `tool` or `reach` is accepted with a warning. Ids and logins are matched without regard to case.
3. **Task fields.** `assignee` and `assignee_type` stay as they are. New, all optional: `reviewer` (who reviews, apart from who does it), `approved_by`, and `approved_on` (a date). The approver must be a human in the roster.
4. **Gaps, not errors.** An owner, reviewer, or approver that is not in the roster, an approver that is an agent, and agent work that is Verified with no human approval are shown as gaps in the Requirement view. They do not fail validation, because the roster can be adopted step by step.
5. **Writing.** The editor changes `assignee`, `assignee_type`, `reviewer`, `approved_by`, and `approved_on` in the task file, and the Issue assignee, only after the person confirms what will change. A human owner with a `github` login becomes the Issue assignee; for an agent the Issue assignee is left as it is, because an agent normally has no GitHub account (DEC-008).

## Reasons

- It is one more entry in a file the person already has, so there is no extra file to find.
- Naming people by `id` lets a task file stay readable when a GitHub login is not the name the team uses.
- Reporting gaps rather than refusing keeps a repository without a roster, or with a partial one, working as it does today.

## Not decided yet

- A roster per repository, for a person who works with different teams.
- Handing a task to a remote agent (`TASK-016`, deferred).
