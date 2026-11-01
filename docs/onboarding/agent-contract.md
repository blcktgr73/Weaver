# The weaver tool: the contract for agents

`weaver` gives an agent, or a person in a terminal, the Kanban operations of Weaver: read the cards, create a task with its Issue and Project card, move a card, link evidence, and reconcile what the Overview reports. It is a command-line tool, so any agent that can run a shell command can use it. It does not depend on one agent product ([REQ-007](../requirements/REQ-007-steward-agent-for-the-kanban.md), [DEC-012](../decisions/DEC-012-steward-first-version.md)).

This page is the contract. Every JSON example below is checked by a test against the output of the tool, so it cannot drift: if the tool changes its output shape, the test fails until this page is updated.

## Set up

1. Sign in once with the GitHub CLI and let it use the Project: `gh auth login -s repo,project`. The tool takes the token from `gh auth token`. It never stores the token, and never writes it to a repository, a task file, or a log ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)).
2. Build it from a checkout: `npm ci && npm run build`. Run `node packages/cli/dist/bin.js <command>` (called `weaver` below).
3. Tell it which Project to read. It takes the configuration from a `fabric.yaml` in the folder it runs in (or `--root <folder>`) when there is one, and otherwise from your personal `~/.weaver/config.yaml` ([DEC-014](../decisions/DEC-014-user-configuration.md)); `WEAVER_HOME` moves that folder. The personal file needs only the Project (`project: {owner, number}`); without a repository list every repository on the Project is read. The files under the folder it runs in (except `node_modules`, `.git`, `dist`, `out`, and `examples`) are the repository files it reads.

## What every command prints

- **Standard output is one JSON document** per command (or readable lines with `--text`). It always has `"schema": 1`. Fields are added, never renamed; a change that would break a reader raises `schema`.
- **Standard error carries what a person should read**: the plan of a write, and its hints.
- **A failure** is `{"schema": 1, "error": {"code": ..., "message": ...}}` on standard output, and a sentence on standard error with `--text`. `code` is stable; `message` follows the language (`--lang en|ko` or the environment variable `WEAVER_LANG`).

<!-- example: notfound -->
```json
{
  "schema": 1,
  "error": {
    "code": "cli.not-found",
    "message": "No card matches \"TASK-999\"."
  }
}
```

| Exit code | Meaning |
| --- | --- |
| 0 | Done, or nothing to do |
| 1 | Failed: no configuration, no token, GitHub unreachable, or a write failed |
| 2 | The command was wrong or refused (unknown command, missing argument, a move to Verified without evidence, a pull request that is not merged) |
| 3 | The card was not found |
| 4 | A write was **not confirmed**: nothing was changed (see below) |
| 5 | A write was **declined** by the person at the terminal: nothing was changed |
| 6 | A command that asks questions (`weaver init`) was run without a terminal |

## Read

`weaver list [--repository owner/name] [--column name]` prints every card of the Project with its task, requirement, stale marks, and gaps.

<!-- example: list -->
```json
{
  "schema": 1,
  "project": {
    "owner": "me",
    "number": 1,
    "title": "Board"
  },
  "cards": [
    {
      "repository": "me/Weaver",
      "number": 10,
      "title": "[TASK-010] Card 10",
      "url": "https://github.com/me/Weaver/issues/10",
      "state": "open",
      "column": "In progress",
      "labels": [
        "status:in-progress"
      ],
      "assignees": [],
      "updatedAt": "2026-10-01T00:00:00Z",
      "boardStatus": "In Progress",
      "task": {
        "id": "TASK-010",
        "path": "tasks/TASK-010.md"
      },
      "requirement": {
        "id": "REQ-001",
        "title": "First",
        "path": "requirements/REQ-001.md"
      },
      "stale": [
        "idle"
      ],
      "gaps": []
    }
  ],
  "skipped": 0
}
```

`weaver show <card>` prints one card with its task file, requirement, and the merged pull requests that close it or name its task. `<card>` is `owner/name#number`, an Issue address, or `TASK-###`.

<!-- example: show -->
```json
{
  "schema": 1,
  "card": {
    "repository": "me/Weaver",
    "number": 10,
    "title": "[TASK-010] Card 10",
    "url": "https://github.com/me/Weaver/issues/10",
    "state": "open",
    "column": "In progress",
    "labels": [
      "status:in-progress"
    ],
    "assignees": [],
    "updatedAt": "2026-10-01T00:00:00Z",
    "boardStatus": "In Progress",
    "task": {
      "id": "TASK-010",
      "path": "tasks/TASK-010.md"
    },
    "requirement": {
      "id": "REQ-001",
      "title": "First",
      "path": "requirements/REQ-001.md"
    },
    "stale": [
      "idle"
    ],
    "gaps": []
  },
  "task": {
    "id": "TASK-010",
    "title": "Card ten",
    "path": "tasks/TASK-010.md",
    "assigneeType": "agent",
    "assignee": "claude-code",
    "criteria": [],
    "blockers": []
  },
  "requirement": {
    "id": "REQ-001",
    "title": "First",
    "path": "requirements/REQ-001.md",
    "status": "draft"
  },
  "pulls": [
    {
      "number": 7,
      "title": "feat: ten (TASK-010)",
      "url": "https://github.com/me/Weaver/pull/7",
      "closes": true
    }
  ],
  "warnings": []
}
```

`weaver process [--repository owner/name]` prints how each repository of the Project tracks its work, from its `.weaver/process.yaml` ([DEC-015](../decisions/DEC-015-process-configuration.md)). For each repository it says whether the file exists (`read`, `missing`, or `failed`), for each of `columns`, `evidence`, and `stale` whether the file set it or it is the default, the values in use, and what is wrong in the file. A repository without the file uses the defaults, which are what Weaver does today.

## Write: the confirmation flow

Every write is a *plan* of actions. An action names exactly what it changes and why, and has an `id` made from that content. **An action runs only after that one action is approved** ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)). There is no `--yes`.

- At a terminal, the tool asks `[y/N]` for each action.
- From an agent there is no terminal, so the flow has two steps:
  1. Run the command. The tool prints the plan, changes nothing, and exits with code **4**. The JSON lists every action with its `id` and `"outcome": "unconfirmed"`.
  2. **Show the plan to the user.** Only after the user agrees to an action, run the same command again with `--approve <id>` (several ids separated by commas). Run only the ids the user approved.

An `id` is bound to the content of the action, so an approval cannot be reused for a different change. If the situation changed between the two runs (for example another task took the next number), the ids differ and nothing runs.

A failed action stops the ones after it (`"outcome": "skipped"`); the actions already done stay done, and the output says which they are.

<!-- example: move -->
```json
{
  "schema": 1,
  "status": "unconfirmed",
  "actions": [
    {
      "id": "0b184aa2fc5c",
      "kind": "card.move",
      "target": "me/Weaver#10",
      "summary": "Move me/Weaver#10 to Review: Remove label: status:in-progress; Add label: status:review; Set board Status: In Progress.",
      "reason": "The card is asked to move to Review, and the labels, the Issue state, and the board Status are made to agree with it.",
      "outcome": "unconfirmed"
    }
  ],
  "skipped": [],
  "report": []
}
```

After the user approved that action, the same command with `--approve 0b184aa2fc5c` runs it:

<!-- example: add-approved -->
```json
{
  "schema": 1,
  "status": "done",
  "actions": [
    {
      "id": "3aee58c12307",
      "kind": "project.add",
      "target": "me/Weaver#12",
      "summary": "Add Issue me/Weaver#12 to the Project me/1.",
      "reason": "The Issue is in a registered repository but not on the Project, so the Overview cannot show it.",
      "outcome": "done"
    }
  ],
  "skipped": [],
  "report": []
}
```

`skipped` lists what a command left out and why (for example an Issue that is already on the Project). `report` is used by `reconcile`.

## Set up

`weaver init` sets up your personal configuration `~/.weaver/config.yaml` in a terminal: it lists the Projects you can read, takes the repositories found on the one you choose (you leave out the ones you do not want), offers the people assigned to its cards for your roster, lets you add agents, shows the file, and writes it only after you say yes. Running it again starts from the file that is there and keeps a copy of the old one as `config.yaml.bak`. It asks questions, so an agent cannot run it: without a terminal it exits with code 6. Ask the user to run it, or write the file by hand ([the format](../product/artifact-schema-v0.1.md#user-configuration)).

## Commands that write

| Command | What it does |
| --- | --- |
| `weaver project add <issue>...` | Adds Issues of registered repositories to the Project. An Issue already there, of an unregistered repository, or not an Issue address is left out with a reason. |
| `weaver task create --title <t> --requirement <REQ-###> [--criteria AC-001,..] [--assignee <name>] [--assignee-type human\|agent] [--area <name>] [--repository <owner/name>]` | Creates the Issue, adds it to the Project, and opens a pull request with the task file and the requirement's task line. |
| `weaver card move <card> --to <column>` | Makes the status label, the Issue state, and the board Status agree with the column. A move to `Verified` needs a linked pull request or an `evidence_exception` in the task. |
| `weaver evidence attach <card> --pull <number or address>` | Comments on the Issue that a merged pull request is its evidence. |
| `weaver reconcile [--apply]` | Plans the fixes for what the Overview reports. Without `--apply` it only shows the plan and the report, and exits 0. |

## Hand a ticket from a conversation to the tool

When the user describes work in a conversation and agrees that it should be tracked, create it in one operation instead of leaving it in the chat:

1. Find the requirement it belongs to (`weaver list` shows the requirements of the cards) and the criteria it serves.
2. Run `weaver task create --title "<short title>" --requirement REQ-### --criteria AC-###`. A title cannot contain a colon or a line break.
3. Show the three planned actions to the user: the Issue, the Project card, and the pull request that adds the task file. The pull request is made in a separate worktree from the default branch, so nothing is committed to the default branch and the user's checkout is not touched.
4. After the user approves, run the command again with the approved ids in `--approve`. Give the user the Issue and pull request addresses from the result.

<!-- example: task -->
```json
{
  "schema": 1,
  "status": "unconfirmed",
  "actions": [
    {
      "id": "4f7e2115bd5f",
      "kind": "issue.create",
      "target": "me/Weaver",
      "summary": "Create the Issue \"[TASK-041] Add the export button\" in me/Weaver with the labels task, status:backlog.",
      "reason": "A ticket becomes a task: the Issue, the Project card, and the task file are created together so it is not forgotten.",
      "outcome": "unconfirmed"
    },
    {
      "id": "ae3be644cdd9",
      "kind": "project.add",
      "target": "me/Weaver TASK-041",
      "summary": "Add the new Issue to the Project me/1.",
      "reason": "A ticket becomes a task: the Issue, the Project card, and the task file are created together so it is not forgotten.",
      "outcome": "unconfirmed"
    },
    {
      "id": "3f6403f44b24",
      "kind": "files.pull-request",
      "target": "me/Weaver docs/task-041-add-the-export-button",
      "summary": "Open a pull request in me/Weaver that adds tasks/TASK-041.md and lists TASK-041 under REQ-001. The default branch is not touched.",
      "reason": "A ticket becomes a task: the Issue, the Project card, and the task file are created together so it is not forgotten.",
      "outcome": "unconfirmed"
    }
  ],
  "skipped": [],
  "report": []
}
```

## Reconcile

`weaver reconcile` reads what the Overview reports and sorts it into the steward's three tiers ([DEC-012](../decisions/DEC-012-steward-first-version.md)): automatic fixes (an Issue added to the Project), proposed fixes (a board Status behind its label, a note about a merged pull request that did not close its Issue, a closed task Issue set to `status:verified`, and the two fixes that change repository files, each offered as a pull request), and items that are only reported (a board ahead of its label, stale cards, a broken Issue link, and the file fixes that cannot be offered safely).

The two file fixes use the same separate worktree as `task create`, so your checkout and the default branch stay untouched. A **task file without an Issue** gets an Issue (created, and put on the Project) and a pull request that writes the link into the task file and the requirement's task line; if the Project already has a card titled with that task, that Issue is linked and none is made. A **card without a task file** gets a pull request that drafts the task file from the Issue and lists it under its requirement, but only when the Issue's title or body names a `REQ-###` that belongs to the same repository; otherwise it stays a report. The owner and criteria of a draft are guesses for the reviewer to check. A fix whose pull request is already open is not offered again. It is a dry run unless `--apply` or `--approve` is given.

<!-- example: reconcile -->
```json
{
  "schema": 1,
  "status": "nothing",
  "actions": [],
  "skipped": [],
  "report": [
    {
      "tier": "proposed",
      "kind": "card-without-file",
      "subject": "#11",
      "message": "#11 of me/Weaver is on the Project, but no task file or requirement lists it: [TASK-011] Card 11",
      "automated": false,
      "url": "https://github.com/me/Weaver/issues/11"
    }
  ]
}
```

## What an agent must never do

- Never approve an action the user has not seen. Never invent, guess, or reuse an `id`.
- Never close an Issue, commit to a default branch, or mark work verified on its own. `weaver` does not do these either; do not work around it with `gh` or `git`.
- Never write the token anywhere, and never paste it into a message.
- Never hide a refusal (exit codes 2 and 5) or a failure (1). Tell the user what happened.

## Identity and the record

The tool acts as the signed-in user's own `gh` login. What it creates on GitHub says "Made by the Weaver steward on behalf of @login." Every executed action adds one line to the local log `~/.weaver/actions.jsonl` (`WEAVER_HOME` moves it; it is never inside a repository): the time, the actor, on whose behalf, the action, the target, the reason, and the outcome.
