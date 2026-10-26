# PALab Weaver VS Code Extension

This is the first implementation slice of Weaver.

## Current scope

- Scan Markdown artifacts in the current workspace.
- Identify `type: requirement` and `type: task` frontmatter.
- Open a requirement from a quick-pick command.
- Report the current requirement/task artifact count.

## Commands

- `Weaver: Open Requirement`
- `Weaver: Scan Workspace`

## Development

```bash
npm install
npm run check
npm run compile
```

Press `F5` from this directory in VS Code to launch an Extension Development Host after adding the standard launch configuration.

## Next slice

The next implementation should add a Requirement Canvas and Task Rail while preserving Markdown readability and Git-native artifacts. SlashMD integration is a product/technical spike, not a dependency of this minimal scanner.
