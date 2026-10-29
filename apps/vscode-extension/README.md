# PALab Weaver VS Code Extension

This is the first implementation slice of Weaver.

## Current scope

- Read every Markdown file in the workspace and validate Weaver artifacts with `@palab/weaver-markdown` (see [Artifact Schema v0.1](../../docs/product/artifact-schema-v0.1.md)).
- Show validation errors and warnings in the Problems panel, refreshed on startup and on save.
- Show a read-only Requirement view: metadata, acceptance criteria, tasks with Issue links, validation gaps. It refreshes on save.
- Read GitHub Issue state and labels for each task (button **Load issue status**, uses your VS Code GitHub sign-in, read-only) and show the Kanban column, owner, and gaps, plus a six-column board. Column rules are in [Product Requirements v0.1](../../docs/product/requirements-v0.1.md#status-mapping).
- Open a requirement's Markdown from a quick-pick command.
- Report requirement/task counts and validation totals.

## Commands

- `Weaver: Show Requirement`
- `Weaver: Open Requirement`
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
