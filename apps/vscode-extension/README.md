# PALab Weaver VS Code Extension

This is the first implementation slice of Weaver.

## Current scope

- Read every Markdown file in the workspace and validate Weaver artifacts with `@palab/weaver-markdown` (see [Artifact Schema v0.1](../../docs/product/artifact-schema-v0.1.md)).
- Show validation errors and warnings in the Problems panel, refreshed on startup and on save.
- Show a read-only Requirement view: metadata, acceptance criteria, tasks with Issue links, validation gaps. It refreshes on save.
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

Press `F5` in VS Code with the repository root open and choose **Weaver: Run Extension**. It builds first and opens an Extension Development Host on this repository.
