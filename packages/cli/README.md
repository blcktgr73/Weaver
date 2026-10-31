# @palab/weaver-cli

The `weaver` command-line tool. It gives any agent, or a person in a terminal, the Kanban operations of Weaver with JSON output ([REQ-007](../../docs/requirements/REQ-007-steward-agent-for-the-kanban.md), [DEC-012](../../docs/decisions/DEC-012-steward-first-version.md)). It has no editor dependency and shares its logic with the VS Code extension through `@palab/weaver-markdown` and `@palab/weaver-github`.

## Use

```bash
gh auth login -s repo,project        # once; the token stays in gh and is never stored by weaver
npm run build
node packages/cli/dist/bin.js list --root .
node packages/cli/dist/bin.js show TASK-043
```

Run it in the folder that holds `fabric.yaml`, or pass `--root <folder>`. Run `weaver --help` for every option.

| Command | Prints |
| --- | --- |
| `weaver list [--repository o/n] [--column name]` | Every card of the Project, with its task, requirement, stale marks, and gaps |
| `weaver show <card>` | One card with its task file, requirement, and the merged pull requests that close it or name its task. `<card>` is `owner/name#number`, an Issue address, or `TASK-###` |

Output is one JSON document on standard output. `--text` prints readable lines instead. A failure prints `{"schema":1,"error":{"code","message"}}` (or a sentence on standard error with `--text`) and exits non-zero: 1 failed, 2 usage, 3 card not found. Messages follow `--lang en|ko` or `WEAVER_LANG`.

`schema` is the version of the JSON. Fields are added, not renamed; a change that breaks a reader raises it.

The write commands come with TASK-044 to TASK-047.
