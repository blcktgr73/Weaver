# Configure how your repository tracks its work

This guide moves a repository from "Weaver's defaults" to its own process, one part at a time. It follows [DEC-015](../decisions/DEC-015-process-configuration.md) and [REQ-005](../requirements/REQ-005-configurable-process.md). Nothing here is required: a repository without a `.weaver/process.yaml` works exactly as before.

The file lives in the repository, in Git, and is the only place the process is set. There is no personal override: two people on one team see the same columns. Weaver reads it from the **default branch** on GitHub, so a change takes effect once it is merged.

## What the file can set

Four sections. Each one is optional, and a field you leave out keeps its default.

| Section | What it decides | Default |
| --- | --- | --- |
| `columns` | Where a card's column comes from: the `status:*` labels or the Project board's Status. | labels |
| `evidence` | Whether a pull request is expected in Review and Verified, whether Verified needs a merged pull request that closes the Issue, and whether a task's `evidence_exception` counts. | all expected, exceptions honored |
| `stale` | How many days without a change make an open card idle. | 14 |
| `task` | The fields a task of your organization carries (owner, priority, a blocker, and so on), which are required, which values are allowed, and where each one lives. | no fields, one task file per card |

The six columns (Backlog, Ready, In progress, Blocked, Review, Verified) and their order are fixed in version 1. A repository maps its own work onto them.

This repository's own [`.weaver/process.yaml`](../../.weaver/process.yaml) spells out every default with comments. Read it first; it is the reference for the field names.

## Step 0. See what Weaver assumes today

```bash
weaver process --text
```

prints one line per repository of your Project, and for each section (`columns`, `evidence`, `stale`, `task`) whether the file sets it or it is a default:

```
me/Weaver    read     columns=repository evidence=repository stale=repository task=default
me/Other     missing  columns=default evidence=default stale=default task=default
```

Without `--text` you get the values in use too. `missing` means the repository has no file. The Requirement view shows the same thing in a "Process" section.

## Step 1. Say where the columns come from

Pick the one that matches how the team already works.

**Your team already uses the status labels** (`status:backlog` … `status:verified`). Do nothing, or write the default out:

```yaml
version: 1
columns:
  source: labels
```

If your labels have other names, name them. Only the columns you list change:

```yaml
version: 1
columns:
  labels:
    Ready: up-next
    Review: needs-review
```

**Your team uses the Project board's Status** and does not want labels. Let the board decide:

```yaml
version: 1
columns:
  source: board-status
```

The default map is `Todo` → Backlog, `In Progress` → In progress, `Done` → Verified. If your board has other options, give the whole map (a map you write replaces the default one):

```yaml
version: 1
columns:
  source: board-status
  board:
    Next: Ready
    Doing: In progress
    Done: Verified
```

With `board-status`, Weaver reads and writes no label. A card whose Status is not in the map is shown in Backlog with a note, and a closed card that is not Done is shown in Review with a note.

> **A board with only Todo, In Progress, and Done cannot tell Ready, Blocked, and Review apart.** With `board-status` on such a board those three columns stay empty, and a move to one of them is refused with a message instead of guessed. That is a limit of the board. Either keep the labels, or give the board a richer Status field and map it as above.

## Step 2. Say what counts as evidence

```yaml
version: 1
evidence:
  pull-request: optional
  closing-pull-request: false
  exceptions: true
```

- `pull-request: optional` removes the gap and the "no evidence" mark for a missing pull request. A pull request that exists is still checked: failing or pending checks, not merged.
- `closing-pull-request: false` lets Verified stand without a merged pull request that closes the Issue, and stops reporting a merged pull request that names the task but does not close it.
- `exceptions: false` makes a task's `evidence_exception` count for nothing in this repository.

A team whose work is mostly decisions or documents, or who do not open pull requests, will usually want the first two.

## Step 3. Set the idle limit

```yaml
version: 1
stale:
  idle-days: 7
```

An integer of 1 or more. A repository that leaves it out uses the `weaver.staleDays` setting of each person's editor, which is 14 unless changed.

## Step 4. Declare the fields of your tasks (optional)

Skip this step if a task needs nothing beyond what Weaver already keeps (`assignee`, `reviewers`, `criteria`). If your team runs agents or a board on a card contract, say what the contract is, and Weaver carries it out ([DEC-016](../decisions/DEC-016-task-contract-in-process-file.md)):

```yaml
version: 1
task:
  require-file: true
  fields:
    owner:
      required: true
      values: [maria, build-agent]
      source: file
      label: "owner:{value}"
    priority:
      values: [P0, P1, P2]
      source: project
      project-field: Priority
  body:
    sections: [Context, Done when]
```

- `fields` names each field of a task file. A field name uses lowercase letters, digits, and hyphens, and cannot reuse a key Weaver owns (`id`, `title`, `issue`, `assignee`, and so on).
- `required: true` reports a task that has no value; `values` reports a value that is not on the list.
- `source: file` (the default) keeps the value in the task file; `label: "owner:{value}"` also shows it on the Issue as a label. `source: project` keeps it on the Project board in the field named by `project-field`.
- A field can have a `label` or a `project-field`, not both, and a field with `source: project` needs one of them.
- `body.sections` lists the headings a task body must contain, in order. `require-file: false` lets a card be an Issue only.

The names above are examples. Use your own. Nothing in Weaver assumes a field name, a role, or a board ([DEC-007](../decisions/DEC-007-central-project-is-configuration.md)), so a repository that leaves this section out behaves exactly as before. In the editor, a field you declare is no longer reported as an unknown field in a task file. `weaver reconcile` lists a task whose value is missing, is not allowed, or differs between the file and the board, and in a task file the file wins.

## Step 5. Commit it as a reviewed change

Add `.weaver/process.yaml` in a pull request like any other change, and say in the description which of the sections you set and why. A team can start with one section and add the others later: a section you leave out stays at its default.

## How a mistake is handled

Each section is judged on its own.

- A section with a wrong value (for example `source: magic`) is reported and **ignored**: that section keeps its defaults and the other sections still apply.
- A file that is not valid YAML, or has a `version` other than 1, is reported and ignored as a whole.
- A field Weaver does not know is a warning and is kept.

In the editor the report shows in the Problems panel when the file is in your workspace. In the terminal, `weaver process` lists the problems of every repository. In either place you can then fix the file and read it again.

## Worked example: a repository with a three-option board

HowMuchToday tracks its work on a Project board with `Todo`, `In Progress`, and `Done`, uses no `status:*` labels, and does not open a pull request for every change. Its file would be:

```yaml
version: 1
columns:
  source: board-status
evidence:
  pull-request: optional
  closing-pull-request: false
```

Its closed cards then show as Verified instead of "Review with gaps", and the "no linked pull request" marks go away. Its Ready, Blocked, and Review columns stay empty, because the board cannot show them (see the note in Step 1).

## Go back

Delete a section to return it to the default, or delete the file to return the whole repository. Nothing else is changed: no label, Issue, or board value is touched by reading or removing the file.
