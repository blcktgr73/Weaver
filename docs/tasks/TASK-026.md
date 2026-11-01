---
id: TASK-026
type: task
title: Drive evidence and verification rules from the configuration
requirement: REQ-005
issue: https://github.com/blcktgr73/Weaver/issues/56
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-003]
assignee: claude-code
---

# TASK-026 Drive evidence and verification rules from the configuration

Tracked in [Issue #56](https://github.com/blcktgr73/Weaver/issues/56). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Whether Verified needs a closing pull request, passing checks, or an explicit exception is set in the configuration, per column.

## Progress

- The three `evidence` settings of [DEC-015](../decisions/DEC-015-process-configuration.md) take effect, in the editor and in the `weaver` tool alike: `evidenceGaps`, the "no evidence" stale mark, the refusal of a move to Verified, the evidence line of the Requirement view and the acceptance coverage, and the "merged pull request does not close the Issue" mismatch. A repository without the file, or without the section, behaves as before (DEC-006).
- `pull-request: optional` removes the gap for a missing pull request only; a pull request that exists is still checked (failing or pending checks, not merged).
- Not tried by hand against a real repository that has a `.weaver/process.yaml`.

