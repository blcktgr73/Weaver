# Configure how your repository tracks its work

This guide moves a repository from "Weaver's defaults" to its own process, one part at a time. It follows [DEC-015](../decisions/DEC-015-process-configuration.md) and [REQ-005](../requirements/REQ-005-configurable-process.md). Nothing here is required: a repository without a `.weaver/process.yaml` works exactly as before.

The file lives in the repository, in Git, and is the only place the process is set. There is no personal override: two people on one team see the same columns. Weaver reads it from the **default branch** on GitHub, so a change takes effect once it is merged.

## What the file can set

Three sections. Each one is optional, and a field you leave out keeps its default.

| Section | What it decides | Default |
| --- | --- | --- |
| `columns` | Where a card's column comes from: the `status:*` labels or the Project board's Status. | labels |
| `evidence` | Whether a pull request is expected in Review and Verified, whether Verified needs a merged pull request that closes the Issue, and whether a task's `evidence_exception` counts. | all expected, exceptions honored |
| `stale` | How many days without a change make an open card idle. | 14 |

The six columns (Backlog, Ready, In progress, Blocked, Review, Verified) and their order are fixed in version 1. A repository maps its own work onto them.

This repository's own [`.weaver/process.yaml`](../../.weaver/process.yaml) spells out every default with comments. Read it first; it is the reference for the field names.

## Step 0. See what Weaver assumes today

```bash
weaver process --text
```

prints one line per repository of your Project, and for each of the three sections whether the file sets it or it is a default:

```
me/Weaver    read     columns=repository evidence=repository stale=repository
me/Other     missing  columns=default evidence=default stale=default
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

## Step 4. Commit it as a reviewed change

Add `.weaver/process.yaml` in a pull request like any other change, and say in the description which of the three sections you set and why. A team can start with one section and add the others later: a section you leave out stays at its default.

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
