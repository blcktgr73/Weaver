---
id: TASK-030
type: task
title: Define and validate the fabric registry
requirement: REQ-006
status: draft
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-030 Define and validate the fabric registry

Define `fabric.yaml` (central Project and registered repositories), write the parser and validation in `packages/markdown`, and document the schema in the artifact schema.

## Done when

- A valid file parses; a missing Project, a duplicate repository, or a malformed entry gives a clear diagnostic.
- The parser takes a file path (DEC-010).
- Tests cover valid and invalid files.
- Messages are in the catalog in English and Korean.
