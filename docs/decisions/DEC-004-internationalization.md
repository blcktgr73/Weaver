# DEC-004: Internationalization approach

- Status: accepted
- Date: 2026-10-30
- Related: `REQ-001`, [DEC-001](./DEC-001-status-vocabulary.md)

## Context

Weaver will be used by people who read English and Korean. Its messages come from two places: the pure logic in `packages/markdown` (validation, gaps, move plans), which produced English sentences directly, and the VS Code extension (view, dialogs, commands). Sentences built in code cannot be translated, and the same logic will later serve other surfaces (a CLI, a server).

## Decision

1. **Languages:** English (`en`, the source language) and Korean (`ko`) first. Another language is a new catalog file; no code change.
2. **Logic returns notices, not sentences.** A notice is `{ code, args }`. Rules, gap detection, and move planning stay free of language. Tests assert codes and arguments.
3. **One message catalog** in `packages/markdown/src/i18n`: `en.ts` is the source and `ko.ts` must define every key (the compiler enforces it). A test checks that both catalogs use the same placeholders.
4. **Surfaces choose the language.** The VS Code extension reads `weaver.language` (`auto`, `en`, `ko`). `auto` follows the VS Code display language and falls back to English.
5. **Not translated:**
   - Workspace content (requirement and task text) stays in the author's language.
   - IDs and machine values: `REQ-###`, lifecycle statuses, `status:*` labels, board Status values.
6. **Korean wording:** messages put IDs and values after a colon instead of attaching particles (은/는, 이/가), so any value reads naturally.
7. **Project documents are written in English** (see AGENTS.md).

## Consequences

- New user-facing text starts as a catalog key. Literal sentences in logic or views are a review finding.
- Kanban column names have catalog keys; the GitHub labels and board values they map to do not change.
- Command titles and setting descriptions use VS Code's `package.nls` files, so they follow the VS Code display language, not `weaver.language` (a VS Code limit). Everything the extension draws itself follows `weaver.language`.
