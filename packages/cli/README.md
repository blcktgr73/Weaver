# @palab/weaver-cli

The `weaver` command-line tool. It gives any agent, or a person in a terminal, the Kanban operations of Weaver with JSON output ([REQ-007](../../docs/requirements/REQ-007-steward-agent-for-the-kanban.md), [DEC-012](../../docs/decisions/DEC-012-steward-first-version.md)). It has no editor dependency and shares its logic with the VS Code extension through `@palab/weaver-markdown` and `@palab/weaver-github`.

For an agent, the contract (every command, the JSON shapes, the exit codes, and what an agent must never do) is [docs/onboarding/agent-contract.md](../../docs/onboarding/agent-contract.md); a test keeps its examples equal to the tool's output.

## Use

```bash
gh auth login -s repo,project        # once; the token stays in gh and is never stored by weaver
npm run build
node packages/cli/dist/bin.js list --root .
node packages/cli/dist/bin.js show TASK-043
```

Run it in the folder that holds `fabric.yaml`, or pass `--root <folder>`. It reads every Markdown file under that folder except `node_modules`, `.git`, `dist`, `out`, and `examples` (sample workspaces are not the repository's own work, and their task numbers would otherwise take part in numbering). Run `weaver --help` for every option.

| Command | Prints |
| --- | --- |
| `weaver list [--repository o/n] [--column name]` | Every card of the Project, with its task, requirement, stale marks, and gaps |
| `weaver show <card>` | One card with its task file, requirement, and the merged pull requests that close it or name its task. `<card>` is `owner/name#number`, an Issue address, or `TASK-###` |
| `weaver project add <issue>...` | A write ([confirmation](#how-every-write-is-confirmed)). Adds Issues of registered repositories that are not on the Project yet. Skips, with the reason, an Issue that is already there, of an unregistered repository, or not an Issue address. `<issue>` is `owner/name#number` or an Issue address |
| `weaver task create --title <t> --requirement <REQ-###> [--criteria AC-001,..] [--assignee <name>] [--assignee-type human\|agent] [--area <name>] [--repository <owner/name>]` | A write ([confirmation](#how-every-write-is-confirmed)) in three actions: create the Issue (labels `task`, `status:backlog`, optional `area:*`), add it to the Project, and open a pull request that adds the task file and lists the task under the requirement. See below |
| `weaver card move <card> --to <column>` | A write. Makes the status label, the Issue state, and the board Status agree with the column (`Backlog`, `Ready`, `In progress`, `Blocked`, `Review`, `Verified`; case and `-` do not matter). It uses the same plan and steps as the editor. A move to `Verified` is refused when no pull request is linked to the Issue and the task has no `evidence_exception`; other gaps (no merged pull request, failing checks) are shown in the plan |
| `weaver evidence attach <card> --pull <number or address>` | A write. Comments on the Issue, in the steward's name, that a merged pull request is its evidence. A pull request that is not merged is refused |
| `weaver reconcile [--apply]` | Reads what the Overview reports (REQ-006) and sorts it into the steward's three tiers (the table is in [DEC-012](../../docs/decisions/DEC-012-steward-first-version.md)). **Automatic**: add an Issue to the Project. **Proposed**: bring a board Status that is behind its label up to it; comment that a merged pull request names the task but did not close the Issue (once; a marker prevents repeats); set a closed task Issue to `status:verified`. **Report only**: a board that is ahead of its label, stale cards, a broken Issue link, and the cases that need a file change (a task file without an Issue, a card without a file), which are not automated yet. Without `--apply` (or `--approve`) it only shows the plan and the report, even at a terminal, and exits 0; with `--apply` it asks about each action as any write does. It never closes an Issue or marks work verified on its own |

Output is one JSON document on standard output. `--text` prints readable lines instead. A failure prints `{"schema":1,"error":{"code","message"}}` (or a sentence on standard error with `--text`) and exits non-zero: 1 failed, 2 usage, 3 card not found, 4 write not confirmed, 5 write declined. Messages follow `--lang en|ko` or `WEAVER_LANG`.

`schema` is the version of the JSON. Fields are added, not renamed; a change that breaks a reader raises it.

## How every write is confirmed

All write commands (`project add`, `task create`, `card move`, `evidence attach`, and `reconcile`) share one path ([DEC-008](../../docs/decisions/DEC-008-agent-identity-and-write-confirmation.md)). A write is first a *plan*: each action names what it changes and why, and has an id made from that exact content. Nothing runs until that action is approved, one action at a time.

- **At a terminal**, the tool shows each action and asks `[y/N]`.
- **From an agent** (no terminal), the tool prints the plan, changes nothing, and exits with code 4. The agent shows the plan to the user and, once they agree, runs the same command again with `--approve <id>` (comma separated for several). An id is bound to the action's content, so an approval cannot be reused for a different change. There is no `--yes`.
- A refusal at the terminal exits with code 5. A failure stops the actions that are left (they are reported as `skipped`) and exits with code 1.
- Each executed action adds one line to the local log `~/.weaver/actions.jsonl` (`WEAVER_HOME` moves it; it is never inside a repository): time, actor, on whose behalf, action, target, reason, outcome.
- Whatever the steward creates on GitHub carries the line "Made by the Weaver steward on behalf of @login." (`attribution()` in `src/actions.ts`).

The output of a write command is `{"schema":1,"status":"done|failed|declined|unconfirmed|nothing","actions":[{id,kind,target,summary,reason,outcome,message?}]}`.

## Create a task from a conversation

```bash
weaver task create --title "Add the export button" --requirement REQ-001 --criteria AC-001 --assignee claude-code
```

The tool takes the next free number (one more than the largest `TASK-###` in the files, on the Project, and in open pull requests) and prints the three actions with their ids. After the user approves, run the same command with `--approve <id>,<id>,<id>`. If the numbers change in between, the ids change and the approval no longer fits, so nothing runs by mistake.

- The pull request is made in a separate `git worktree` from the default branch of the repository, so your own checkout, its uncommitted files, and the default branch are not touched. The worktree is removed afterwards, also when a step fails.
- The task file goes next to the existing task files, and the requirement's task line goes at the end of the list under `## Tasks` as it is on the default branch.
- If a later action fails, the output lists what was already created (for example the Issue) and the rest are `skipped`.
- The title must not contain a colon or a line break, because it goes into the task file header.
