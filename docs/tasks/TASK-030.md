---
id: TASK-030
type: task
title: Define and validate the fabric registry
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/62
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-030 Define and validate the fabric registry

Tracked in [Issue #62](https://github.com/blcktgr73/Weaver/issues/62). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Define `fabric.yaml` (central Project and registered repositories), write the parser and validation in `packages/markdown`, and document the schema in the artifact schema.

## Done when

- A valid file parses; a missing Project, a duplicate repository, or a malformed entry gives a clear diagnostic.
- The parser takes a file path (DEC-010).
- Tests cover valid and invalid files.
- Messages are in the catalog in English and Korean.
