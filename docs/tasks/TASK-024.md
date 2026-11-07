---
id: TASK-024
type: task
title: Read the configuration and keep today's behavior as the default
requirement: REQ-005
issue: https://github.com/ebrAIn-Lab-3B/Weaver/issues/54
repository: ebrAIn-Lab-3B/Weaver
assignee_type: agent
criteria: [AC-001, AC-002]
assignee: claude-code
---

# TASK-024 Read the configuration and keep today's behavior as the default

Tracked in [Issue #54](https://github.com/ebrAIn-Lab-3B/Weaver/issues/54). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Load and validate the file in the Markdown package. With no file, every existing test must pass unchanged. Report an invalid file in the Problems panel.

## Progress

- Evidence (2026-11-02, `main` at 9a9826a): `npm test` passes in all three packages: markdown 261 tests (20 files), github 65 (9 files), cli 130 (11 files). No test was changed for this task, so "with no file, every existing test passes unchanged" holds.
- With no file, the process is all defaults (`packages/markdown/test/process.test.ts`: "means all defaults for no file content, an empty file, or only a version", and the default-label tests).
- An invalid file is reported, not thrown, and the defaults are kept. The same file tests invalid YAML, a non-mapping or unknown version, a bad column source, wrong column values, unknown fields, and that each issue carries the file path. A repository without the file is a normal answer (`packages/github/test/processFile.test.ts`).
- The workspace scan reads every `.weaver/process.yaml` and adds its issues to the Problems panel (`apps/vscode-extension/src/workspace.ts`).
- Not verified: the Problems panel itself was not opened by hand with an invalid file. That step has no automated test.
