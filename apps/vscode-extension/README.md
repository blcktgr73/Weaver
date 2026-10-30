# PALab Weaver VS Code Extension

This is the first implementation slice of Weaver.

## Current scope

- Read every Markdown file in the workspace and validate Weaver artifacts with `@palab/weaver-markdown` (see [Artifact Schema v0.1](../../docs/product/artifact-schema-v0.1.md)).
- Show validation errors and warnings in the Problems panel, refreshed on startup and on save.
- Show a read-only Requirement view: metadata, acceptance criteria, tasks with Issue links, validation gaps. It refreshes on save.
- Read GitHub Issue state and labels for each task (button **Load issue status**, uses your VS Code GitHub sign-in, read-only) and show the Kanban column, owner, and gaps, plus a six-column board. Column rules are in [Product Requirements v0.1](../../docs/product/requirements-v0.1.md#status-mapping).
- Show execution evidence per task: pull requests that reference the Issue, whether they merged, and their check results, plus evidence gaps (no PR, no merged PR, failing/missing checks) once a task is in Review or Verified. The Verified move confirmation lists current gaps. Each PR is labelled "closes Issue" (its title or body says `Closes #n`, `Fixes #n`, or `Resolves #n`) or "mentions Issue". Weaver reports gaps; it never decides acceptance.
- Move a task to another column from its Status cell. Every move shows exactly what will change on GitHub (labels, Issue state, shared board Status) and asks first. Rules: [DEC-003](../../docs/decisions/DEC-003-board-status-mapping.md). Moving needs the `project` GitHub scope, requested only at that moment.
- Show who owns each task (human or agent) from task files under `docs/tasks/` ([DEC-005](../../docs/decisions/DEC-005-task-files.md)). The Issue assignee is only a fallback hint. A task past the backlog with no owner is a gap.
- Map each acceptance criterion to the tasks that claim it (`criteria: [AC-001]` in task files) and show how far their evidence goes: no task, status not loaded, in progress, verified, or verified with evidence gaps. A criterion no task claims is a gap once any task maps criteria. Weaver reports where evidence stands; acceptance stays a human decision.
- Report gaps in the evidence rules of [DEC-006](../../docs/decisions/DEC-006-closing-pr-evidence.md): a Verified task needs a merged pull request that closes its Issue (`Closes #n`), or a recorded `evidence_exception`. When the GitHub `project` scope is available, a board Status that disagrees with the label is a gap too.
- Show a task's recorded blockers and a pending human decision (`status: needs-human-decision` in its task file) as gaps.
- **Record acceptance** (button at the top of the view): lists the open items (criteria that are not verified, blockers, pending decisions), asks for confirmation, then writes `status: accepted`, `accepted_by`, and `accepted_on` into the requirement file. The change is an ordinary edit you can review and commit. Weaver never accepts on its own.
- Open a requirement's Markdown from a quick-pick command. Several PRs with the same check state are reported as one gap line.
- Report requirement/task counts and validation totals.
- Show validation messages, gaps, and move summaries in English or Korean. Set `weaver.language` to `auto` (follows the VS Code display language), `en`, or `ko`. Approach: [DEC-004](../../docs/decisions/DEC-004-internationalization.md).

Install and first use: [Getting started](../../docs/onboarding/getting-started.md). Build an installable file with `npm run package` from the repository root. Ways to share or publish it: [Distributing the extension](../../docs/onboarding/distribution.md).

## Commands

- `Weaver: Open Requirement View` — the Weaver screen. Also available as the preview button at the top right of a Markdown editor.
- `Weaver: Open Requirement Source` — the requirement's Markdown in the editor.
- `Weaver: Scan Workspace`

## Development

From the repository root:

```bash
npm install
npm run check
npm run build
npm test
```

To launch without the debugger, run `npm run dev` from the repository root. It builds and opens an Extension Development Host on `examples/sample-workspace`. (VS Code redirects to the existing window if the same folder is already open, so the host cannot open the repository root itself.)

Or press `F5` in VS Code with the repository root open and choose **Weaver: Run Extension**. It builds first and opens an Extension Development Host on `examples/sample-workspace`.
