---
id: TASK-074
type: task
title: Fix the form of the roster file and add a sample
requirement: REQ-011
issue: https://github.com/ebrAIn-Lab-3B/Weaver/issues/177
repository: ebrAIn-Lab-3B/Weaver
assignee_type: agent
criteria: [AC-007]
assignee: claude-code
---

# TASK-074 Fix the form of the roster file and add a sample

Tracked in [Issue #177](https://github.com/ebrAIn-Lab-3B/Weaver/issues/177). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

[DEC-017](../decisions/DEC-017-shared-roster-by-reference.md) fixed the entries of the roster (party, role, reach) and how it is referenced, but not the file that holds them. Fix the form of that file, so an organization can write its roster by hand: the file is a YAML mapping with a `contributors` list, kept in a repository the organization owns, and its entries follow the schema. Add `examples/roster.example.yaml` with a comment on each field, and describe the file in the [artifact schema](../product/artifact-schema-v0.1.md).

The sample is checked by the reader of `TASK-070`, which must read it with no issue. Adding and editing from the editor is `TASK-075`.
