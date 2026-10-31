# Getting started with Weaver in VS Code

This guide takes a repository from nothing to a Requirement view with tasks, owners, evidence, and acceptance. It needs VS Code 1.90 or later and a GitHub account that can read the repository.

## 1. Install the extension

Build the VSIX from a checkout of this repository, or download the `weaver-vsix` artifact of a CI run:

```bash
npm ci
npm run package        # writes dist/weaver-<version>.vsix
code --install-extension dist/weaver-0.0.1.vsix
```

Run the install command from the repository root, and keep the `dist/` prefix. For other ways to share or publish the build, see [Distributing the extension](distribution.md).

The extension ID is `palab.weaver`. To try it without installing, run `npm run dev` (sample workspace) or `npm run dev:docs` (this repository's product documents) from a checkout.

## 2. Describe a requirement

In the repository you want to trace, add a Markdown file with frontmatter. Place it anywhere; Weaver reads every Markdown file in the workspace.

```markdown
---
id: REQ-001
type: requirement
title: Users can export their data
status: in-progress
owner: Your team
repository: your-org/your-repo
github_project: Your Kanban board
---

# Users can export their data

## Acceptance criteria

- An export file contains every record the user owns.
- The export finishes within one minute for 10,000 records.

## Tasks

- `TASK-001` Add the export endpoint — [GitHub Issue #12](https://github.com/your-org/your-repo/issues/12)
- `TASK-002` Add the export button
```

The full field list and rules are in the [Artifact Schema](../product/artifact-schema-v0.1.md). IDs are `REQ-###` and `TASK-###`; criteria are numbered `AC-001`, `AC-002` in order.

## 3. Add task files for ownership and criteria

Create `docs/tasks/TASK-001.md`. A task file records who owns the task and which criteria it satisfies ([DEC-005](../decisions/DEC-005-task-files.md)):

```markdown
---
id: TASK-001
type: task
title: Add the export endpoint
requirement: REQ-001
issue: https://github.com/your-org/your-repo/issues/12
assignee_type: agent
assignee: claude-code
criteria: [AC-001, AC-002]
---
```

`assignee_type` is `human` or `agent`. With an `issue` link the Kanban column comes from the Issue, so `status` is optional. Add `blockers: [text]` or `status: needs-human-decision` to make a blocker or a pending decision visible.

## 4. Prepare the Issues

Weaver reads the Kanban column from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md)):

| Column | Label | Issue state |
| --- | --- | --- |
| Backlog | `status:backlog` | open |
| Ready | `status:ready` | open |
| In progress | `status:in-progress` | open |
| Blocked | `status:blocked` | open |
| Review | `status:review` | open |
| Verified | `status:verified` | closed |

Create these labels once. Use `Closes #<number>` in the pull request that finishes an Issue ([DEC-006](../decisions/DEC-006-closing-pr-evidence.md)). Weaver tells a closing pull request from one that only mentions the Issue.

## 5. Use the view

1. Open the requirement file and press the preview button at the top right of the editor, or run **Weaver: Open Requirement View**.
   A requirement file named `REQ-*.md` opens as the view by default; nothing needs to be configured. **Open source** in the view shows the Markdown text, and `Reopen Editor With…` → **Text Editor** does the same. To always open these files as text, add this to your user settings:

   ```json
   "workbench.editorAssociations": { "REQ-*.md": "default" }
   ```

2. Sign in to GitHub when VS Code asks. Reading needs the `repo` scope. Moving a card also needs `project`, asked only at that moment.
3. The view shows the criteria with their tasks and evidence state, the task table (Issue, column, evidence, owner), one line of stage counts, and the gaps. The board itself is on the Overview (section 7).
4. Change a task's column from its Status cell. Every move lists what it will change on GitHub and asks first.
5. When you decide the requirement is done, press **Record acceptance**. Weaver lists what is still open and writes `status: accepted`, `accepted_by`, and `accepted_on` into the file after you confirm. Weaver never accepts by itself.

Problems in the Markdown files (a missing field, an unknown task) appear in the Problems panel.

## 6. Language

Set `weaver.language` to `auto`, `en`, or `ko`. `auto` follows the VS Code display language and falls back to English ([DEC-004](../decisions/DEC-004-internationalization.md)).

## 7. See every repository on one board (Overview)

The Overview shows the work of all registered repositories on one Kanban: the columns are the stages, and each registered repository is a lane. A card shows its Issue, its task, and the requirement it belongs to when the files in your workspace say so. Pressing the requirement tag opens that requirement.

1. Put a `fabric.yaml` at the root of the folder you open ([schema](../product/artifact-schema-v0.1.md#fabric-registry)):

   ```yaml
   project:
     owner: your-login-or-organization
     number: 1
   repositories:
     - your-org/your-repo
   ```

   To use your own personal or organization Project, follow [Register your own Project](register-your-project.md).

2. Open that folder in VS Code. The Overview opens by itself when the file exists, or run **Weaver: Open Overview**.
3. Press **Sign in to GitHub** the first time. The board is read with your VS Code sign-in and needs the `repo` and `project` scopes.
4. To try it from a checkout of this repository, run `npm run dev:overview`. It opens `examples/overview.code-workspace` (the example registry plus `docs`). The repository root itself cannot be opened in a development host while it is already open in another VS Code window.

Adjusting the lanes: the **Projects** chips above the board turn a project on or off (**Show all** brings them back), the ▾ beside a lane title folds it to its title (its card and blocked-card counts stay visible), and the ▲ ▼ beside it move it up or down among the lanes that are shown. These choices stay on your computer, survive a restart, and are never written to the repository. A repository you have not placed keeps the order of `fabric.yaml`.

What a card opens (each opens as a new tab in the same editor group, so the screen is not split; close a tab or use the tab list to go back):

- **The card title** opens its requirement view, scrolled to the task. For a card with no requirement file in the workspace, it opens the Issue on GitHub.
- **The requirement tag** (for example `REQ-006`) opens the requirement view from the top.
- **`#62`** opens the Issue on GitHub.
- **Right-click a card** to choose among the task file, the requirement source, the Issue, a pull request that refers to the Issue (needs the GitHub sign-in), and the repository folder. A place that cannot open is listed with the reason.

**When GitHub cannot be read** (no network, a rejected sign-in, a missing scope), the Overview says why and shows a read-only board under the message. Every successful read of the Project is kept on your computer (never in the repository), and that last board is shown with how long ago it was read, for example *3 hours ago*. Requirement tags still come from the files in your workspace, but stale marks and mismatches are not shown, because they would judge old data against today. A kept read of a different Project than `fabric.yaml` names now is ignored.

When nothing has been kept yet (the first run without a connection), the board is built from the files in your workspace instead, with a note that its state may be out of date. A task's column comes from the `status` in its task file. A task whose file gives no status (the Issue has it, [DEC-005](../decisions/DEC-005-task-files.md)) is shown in Backlog marked *state unknown*, and a cancelled task is left out. Cards from files have no right-click menu, but their titles still open the requirement.

**Show on the Overview** goes the other way. Press it in a requirement view, or in the editor title bar of a requirement or task file, and the Overview opens with that requirement's cards (or that task's card) outlined and scrolled into view. A project that was turned off is turned on and its lane is unfolded. **Clear highlight** removes the outline. When the requirement has no card, Weaver says so; its Issues may not be on the Project.

A card can carry up to three **stale marks**, each shown on its own:

- *no change for N days*: an open card in Ready, In progress, Blocked, or Review whose Issue has not changed for the limit or longer. The limit is the setting `weaver.staleDays` (14 days by default). Backlog and Verified cards, and closed Issues, are never idle.
- *no linked pull request*: a card in Review or Verified that no pull request closes or mentions. A task with an `evidence_exception` is left out.
- *waiting for a human decision*: the task file says `status: needs-human-decision`.

The **Mismatches** list above the board shows where the files, the Issues, and the Project disagree: a task file with no Issue, a task whose Issue is not on the Project, a card that no task file or requirement lists, a merged pull request that names a task but does not close its Issue (an Issue that is already closed is left out), and a board Status that its label does not give. Weaver only reports these; it changes nothing. A card is judged against files only for repositories whose files are in your workspace.

Cards of a repository that is not cloned in your workspace still appear, but they have no requirement tag because Weaver has only the files it can see. The lane order is the order in `fabric.yaml`. The Overview is read-only; to move a card, use a requirement view.

### Clone the registered repositories

Keep the clones of all registered repositories under one folder, the *fabric root*, and open that folder in VS Code to see them in one workspace.

1. Run **Weaver: Set Fabric Root Folder** (or press **Clone missing repositories** in the Overview) and choose the folder. It is saved as the machine setting `weaver.fabricRoot` and is never written to the repository.
2. Run **Weaver: Clone Registered Repositories**. Weaver lists the registered repositories that are not under the root yet; untick any you want to skip. It runs `git clone https://github.com/<owner>/<name>.git` for each, so your Git sign-in must be able to read them.
3. A folder that already exists is never touched. A folder that exists but is not a Git repository is listed and skipped. One failed clone does not stop the others, and the summary names each failure.
4. Run **Weaver: Open Fabric Root Folder** to open the root. Cards of a repository cloned there get **Repository folder** in their right-click menu even when it is not open in this window.

Two registered repositories with the same name are cloned as `<owner>-<name>`.

## What Weaver does not do yet

- A requirement view reads one repository at a time. The Overview shows the registered repositories together, read-only.
- Board Status is compared with the label only when the GitHub token has the `project` scope.
- Owners and criteria are edited in Markdown; the view does not write them.
