---
id: REQ-007
type: requirement
title: A steward agent keeps the Kanban, the Issues, and the repository files in step
status: draft
owner: PALab
story_ids: [US-027, US-028, US-031]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# A steward agent keeps the Kanban, the Issues, and the repository files in step

## Problem

Even when intent lives in repositories and the board is central, someone must keep the links current: create the Issue for a new task, add it to the Project, attach the pull request, and notice what has gone quiet. Done by hand this takes the energy teams do not want to spend, so the board drifts and is abandoned. In chat, a ticket created while talking with an agent is easily forgotten once the conversation moves to the next one.

## Outcome

An agent, called the steward here, reads the Overview Kanban built in [REQ-006](./REQ-006-overview-kanban-across-repositories.md) and does the routine bookkeeping. A ticket created in a conversation becomes a task file, an Issue, and a Project card in one step. The steward registers what is missing, attaches evidence, and reports what is stale. People only confirm decisions that matter.

## Authority boundaries

The steward acts in three tiers:

| Tier | Meaning | Examples |
| --- | --- | --- |
| Automatic | Records a fact and is easy to undo | Add an existing Issue to the Project; attach a merged pull request link as evidence |
| Proposed | Changes repository files or the meaning of a card | Create the task file and Issue link as a pull request; create a file for an orphan card; move a card to Verified |
| Report only | Needs a human judgment | Broken Issue link; a card idle for too long; conflicting status |

The steward never commits to a default branch, never closes an Issue, and never marks work verified without evidence or an explicit human confirmation. This keeps the rule of `TASK-007` (explicit confirmation before a move) for agents as well as people.

## Acceptance criteria

- A command-line tool, `weaver`, offers the Kanban operations to any agent with machine-readable (JSON) output: list cards, show a card, create a task with its Issue and Project card, move a card, and attach evidence. The editor commands and any future agent-protocol server call the same logic and do not duplicate it.
- A ticket described in a conversation can be turned into a task file, an Issue, and a Project card with one operation, and the result is shown to the user for confirmation.
- The steward resolves the mismatch kinds reported by REQ-006 according to the tiers above, and each action is recorded with who or what did it and why.
- A change to repository files is offered as a pull request. A change that needs confirmation does not happen until a person confirms it.
- The steward can run on demand and on a schedule or repository event. A run that finds nothing to do leaves no changes.
- The tool does not depend on one agent product. A different agent can use it by following the same documented contract (see `US-019`).
- The agent's access token is stored outside the repository, with the smallest scope that allows the actions above.
- Every user-facing message for this feature is in the message catalog in English and Korean.

## Open decisions

- Which operations the first version of the tool supports and which stay manual.
- How a conversation hands a ticket to the tool: a direct command, an agent-protocol (MCP) server, or a file the steward picks up.
- How long a card may stay idle before it is marked stale, and whether this is set per repository.
- How the steward is triggered on a schedule: a GitHub Action, a local job, or a remote agent.
- Approving several proposals at once, and a dedicated bot identity for unattended runs.
- Token scopes for a personal Project versus an organization Project.

## Decisions taken

- Agents run as the signed-in user's `gh` login, and every write is confirmed one action at a time: [DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md).

Open decisions are recorded as `DEC-###` documents before the related tasks start.

## Tasks

Tasks are not created yet. This requirement starts after REQ-006 has settled the data structure, because the write rules depend on it.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
