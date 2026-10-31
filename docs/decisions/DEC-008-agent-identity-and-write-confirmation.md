# DEC-008: Agents run as the signed-in user and every write is confirmed

- Status: accepted
- Date: 2026-10-31
- Related: `REQ-007`, `TASK-007`, [DEC-006](./DEC-006-closing-pr-evidence.md), `US-019`

## Context

[REQ-007](../requirements/REQ-007-steward-agent-for-the-kanban.md) lets an agent keep the Kanban, the Issues, and the repository files in step. The agent needs a GitHub identity and a rule for when it may write. A dedicated bot account adds setup and token management that the first version does not need.

## Decision

1. **Identity.** The first version has no separate agent account. The agent runs with the user's own `gh` login. The user adds the `project` scope when writes to a Project are needed (`gh auth refresh -s project`). The token stays in `gh`'s secure store and is never written to a repository, a task file, or a log.
2. **Confirmation.** Reads need no confirmation. Each write (create an Issue, add a card, attach evidence, move a card) is shown with its exact content and runs only after the user approves that one action. This is the rule of `TASK-007` extended to agents.
3. **Attribution.** An Issue, comment, or label added by an agent says that it was made by the steward on behalf of the user. The action is also written to a local action log with who or what did it and why.
4. **Repository files.** A change to repository files is offered as a pull request and never committed to the default branch.

## Not decided yet

- Approving several proposals at once.
- Scheduled runs without a person present. Both probably need a dedicated bot identity, for example a GitHub App, and get their own decision.
- Token scopes for a personal Project versus an organization Project. A personal Project may not accept a fine-grained token and may need a classic token with the `project` scope. This is checked before implementation.

## Consequences

- An agent's work is mixed with the user's in GitHub history, which is why item 3 exists.
- Because the user's own login is used, the same tool works the same way for any agent that can run `gh`, which keeps the contract independent of one agent product.
