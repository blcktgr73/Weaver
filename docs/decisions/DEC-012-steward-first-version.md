# DEC-012: The first version of the steward is an on-demand command-line tool

- Status: accepted
- Date: 2026-11-01
- Related: `REQ-007`, [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md), `TASK-043` to `TASK-049`

## Context

[REQ-007](../requirements/REQ-007-steward-agent-for-the-kanban.md) listed open decisions about the first version. [DEC-008](./DEC-008-agent-identity-and-write-confirmation.md) already fixes identity and confirmation. This record settles the rest so that the tasks can start. It was proposed and accepted on 2026-11-01.

## Decision

1. **Operations in the first version.** Read: `list`, `show`. Write: add Issues to the Project, create a task with its Issue and card, move a card, attach evidence, and `reconcile` as a dry run by default. Closing an Issue, deleting anything, and editing a requirement's meaning stay manual.
2. **How a conversation hands over a ticket.** A direct command. An agent that can run a shell calls `weaver task create`. A Model Context Protocol (MCP) server can wrap the same logic later; it is not built first.
3. **Idle limit.** One value for all repositories, the existing `weaver.staleDays` (14 days). A per-repository value in `fabric.yaml` waits until someone needs it.
4. **Triggers.** On demand only at first. A schedule or repository event is a separate decision, because unattended runs probably need a bot identity (see DEC-008, "Not decided yet").
5. **Confirmation.** DEC-008 stands: every write is confirmed one action at a time. The "automatic" tier of REQ-007 therefore means "needs no extra judgment", not "runs without asking". Approving several proposals in one go is deferred.
6. **Tokens.** The signed-in `gh` token with `repo` and `project` scopes. Organization Projects are not verified.

## Reconcile rules

| Mismatch | Tier | Proposed action |
| --- | --- | --- |
| Task whose Issue is not on the Project | Automatic | Add the Issue to the Project. |
| Merged pull request names a task but does not close its Issue | Proposed | Comment the link on the Issue; closing it stays with a person. |
| Board status differs from the label | Proposed | If the board is behind the label, set the board status to the label. If the board is ahead (a person or a board rule moved it first), report it: moving it back undoes progress, and making the label follow could close the Issue. `weaver card move` is the way to fix it by hand. |
| Project card without a task file | Proposed | Draft the task file as a pull request. |
| Task file without an Issue | Proposed | Create the Issue and link it, as a pull request for the file. |
| Closed Issue without `status:verified` (shown as a card gap) | Proposed | Set the label to `status:verified`; an Issue closed by a pull request keeps its old label ([DEC-003](./DEC-003-board-status-mapping.md)). |
| Issue link that is not an Issue address | Report only | List it. |
| Card idle, without evidence, or waiting for a decision | Report only | List it. |

## Reasons

- A command-line tool is the smallest thing that any agent, including ones without MCP, can call, and the editor can share its logic.
- Keeping unattended runs out of the first version avoids the bot-identity question until the on-demand flow has proven itself.

## Consequences

- `REQ-007` lists these answers under "Decisions taken". The scheduling and batch-approval decisions stay open.
