---
id: TASK-048
type: task
title: Reconcile mismatches according to the steward tiers
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/99
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-003, AC-004, AC-005]
assignee: claude-code
---

# TASK-048 Reconcile mismatches according to the steward tiers

Tracked in [Issue #99](https://github.com/blcktgr73/Weaver/issues/99). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Add `weaver reconcile`, which reads the mismatches of REQ-006 and prints a plan sorted into the three tiers of REQ-007. It is a dry run by default. Proposed and automatic items go through the write path of TASK-044; report-only items are only listed. The rule table is in the notes of DEC-012.

## Done when

- Each mismatch kind maps to a tier and a proposed action, and the table is in the code and in the documentation.
- A run with nothing to do prints that and changes nothing.
- No action closes an Issue, commits to a default branch, or marks work verified on its own.
- The same run can be started by hand or by a schedule; scheduling itself is not part of this task.
- Tests cover each mismatch kind and an empty run.
