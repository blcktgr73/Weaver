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
   A requirement file named `REQ-*.md` can also open as the view directly: right-click its tab or use `Reopen Editor With…` and choose **Weaver Requirement View**. To make this the default for requirement files, add this to your user settings:

   ```json
   "workbench.editorAssociations": { "REQ-*.md": "weaver.requirementEditor" }
   ```

   **Open source** in the view brings back the Markdown text.
2. Sign in to GitHub when VS Code asks. Reading needs the `repo` scope. Moving a card also needs `project`, asked only at that moment.
3. The view shows the criteria with their tasks and evidence state, the task table (Issue, column, evidence, owner), the Kanban board, and the gaps.
4. Change a task's column from its Status cell. Every move lists what it will change on GitHub and asks first.
5. When you decide the requirement is done, press **Record acceptance**. Weaver lists what is still open and writes `status: accepted`, `accepted_by`, and `accepted_on` into the file after you confirm. Weaver never accepts by itself.

Problems in the Markdown files (a missing field, an unknown task) appear in the Problems panel.

## 6. Language

Set `weaver.language` to `auto`, `en`, or `ko`. `auto` follows the VS Code display language and falls back to English ([DEC-004](../decisions/DEC-004-internationalization.md)).

## What Weaver does not do yet

- It reads one repository at a time. Several repositories in one workspace are not supported.
- Board Status is compared with the label only when the GitHub token has the `project` scope.
- Owners and criteria are edited in Markdown; the view does not write them.
