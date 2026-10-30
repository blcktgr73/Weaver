# PALab Weaver VS Code Extension

This is the first implementation slice of Weaver.

## Current scope

- Read every Markdown file in the workspace and validate Weaver artifacts with `@palab/weaver-markdown` (see [Artifact Schema v0.1](../../docs/product/artifact-schema-v0.1.md)).
- Show validation errors and warnings in the Problems panel, refreshed on startup and on save.
- Show a read-only Requirement view: metadata, acceptance criteria, tasks with Issue links, validation gaps. It refreshes on save.
- Read GitHub Issue state and labels for each task (button **Load issue status**, uses your VS Code GitHub sign-in, read-only) and show the Kanban column, owner, and gaps, plus a six-column board. Column rules are in [Product Requirements v0.1](../../docs/product/requirements-v0.1.md#status-mapping).
- Show execution evidence per task: pull requests that reference the Issue, whether they merged, and their check results, plus evidence gaps (no PR, no merged PR, failing/missing checks) once a task is in Review or Verified. The Verified move confirmation lists current gaps. Weaver reports gaps; it never decides acceptance.
- Move a task to another column from its Status cell. Every move shows exactly what will change on GitHub (labels, Issue state, shared board Status) and asks first. Rules: [DEC-003](../../docs/decisions/DEC-003-board-status-mapping.md). Moving needs the `project` GitHub scope, requested only at that moment.
- Open a requirement's Markdown from a quick-pick command. Several PRs with the same check state are reported as one gap line.
- Report requirement/task counts and validation totals.

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
