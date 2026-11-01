---
id: TASK-015
type: task
title: Record reviewers and human approval of agent work
requirement: REQ-002
issue: https://github.com/blcktgr73/Weaver/issues/38
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-004]
assignee: claude-code
---

# TASK-015 Record reviewers and human approval of agent work

Tracked in [Issue #38](https://github.com/blcktgr73/Weaver/issues/38). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Add reviewer and approver to the task file, show them in the view, and record who approved agent work and when.

## Progress

- A task file's `reviewer`, `approved_by`, and `approved_on` are shown under the owner, and "Reviewer…" and "Approval…" record them after the same confirmation. Only a person can be picked to approve. Work by an agent that is Verified without a human approval on record is a gap (`gap.no-human-approval`).

