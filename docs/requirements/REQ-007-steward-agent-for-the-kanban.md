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

- How the steward is triggered on a schedule or a repository event: a GitHub Action, a local job, or a remote agent. The first version runs on demand only ([DEC-012](../decisions/DEC-012-steward-first-version.md)).
- Approving several proposals at once, and a dedicated bot identity for unattended runs.
- Token scopes for an organization Project, and whether a fine-grained token can replace a classic one.

## Decisions taken

- Agents run as the signed-in user's `gh` login, and every write is confirmed one action at a time: [DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md).
- The first version is an on-demand command-line tool that agents call from a shell, with one idle limit and one confirmation rule: [DEC-012](../decisions/DEC-012-steward-first-version.md).

Open decisions are recorded as `DEC-###` documents before the related tasks start.

## Review of remaining gaps (2026-11-01)

| Criterion | Proof | Not yet proven or not done |
| --- | --- | --- |
| AC-001 the `weaver` tool, JSON, shared logic | `packages/cli` tests; the move, Issue, evidence, and board calls moved to `packages/github` and the editor calls the same functions | The editor's move was not driven again after that move of code |
| AC-002 a ticket becomes a task, an Issue, and a card in one operation | `task create` tests with a fake GitHub and a fake `git` | A real run: it creates an Issue and a pull request, so it waits for a person to approve one |
| AC-003 mismatches resolved by tier, each action recorded | `reconcile` tests, the action log tests, a dry run on the real Project | `task-without-issue` and `card-without-file` need a file-changing pull request and are only reported. No real `--apply` was run |
| AC-004 files change only as a pull request, and only after confirmation | `task create` works in a separate worktree; confirmation tests | none |
| AC-005 on demand and on a schedule, nothing to do leaves no change | On demand and the empty run are tested | **Schedule or repository event: not built** (open decision above) |
| AC-006 not tied to one agent product | `agent-contract.md`, with a test that runs every documented command | Another agent product actually using it |
| AC-007 token outside the repository, smallest scope | The token comes from `gh`; it is never stored | Smaller scopes for an organization Project are unverified |
| AC-008 messages in the catalog | en/ko parity test for every message the tool writes | The error text that GitHub returns inside a failed action is English only |

Also not covered by tests: the `[y/N]` question at a terminal (`readline` in `bin.ts`) and `git worktree` on Windows. The tool is built from a checkout; there is no installable package yet.

## Tasks

- `TASK-043` Create the weaver command-line tool with a JSON contract and list and show — [GitHub Issue #94](https://github.com/blcktgr73/Weaver/issues/94)
- `TASK-044` Confirm each write and record it in a local action log — [GitHub Issue #95](https://github.com/blcktgr73/Weaver/issues/95)
- `TASK-045` Add existing Issues to the Project from the command line — [GitHub Issue #96](https://github.com/blcktgr73/Weaver/issues/96)
- `TASK-046` Create a task with its Issue and Project card in one operation — [GitHub Issue #97](https://github.com/blcktgr73/Weaver/issues/97)
- `TASK-047` Move a card and attach evidence from the command line — [GitHub Issue #98](https://github.com/blcktgr73/Weaver/issues/98)
- `TASK-048` Reconcile mismatches according to the steward tiers — [GitHub Issue #99](https://github.com/blcktgr73/Weaver/issues/99)
- `TASK-049` Write the agent contract for the weaver tool — [GitHub Issue #100](https://github.com/blcktgr73/Weaver/issues/100)

The approach for the first version is [DEC-012](../decisions/DEC-012-steward-first-version.md). `TASK-043` and `TASK-044` come first; the write tasks follow `TASK-044`; `TASK-048` needs `TASK-045` to `TASK-047`. Scheduled runs and batch approval have no task until they are decided.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
