---
id: TASK-016
type: task
title: Decide the agent handoff contract
requirement: REQ-002
issue: https://github.com/blcktgr73/Weaver/issues/39
repository: blcktgr73/Weaver
assignee_type: human
criteria: [AC-005, AC-006]
assignee: blcktgr73
---

# TASK-016 Decide the agent handoff contract

Tracked in [Issue #39](https://github.com/blcktgr73/Weaver/issues/39). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Write a decision record: what context a remote agent receives, how it is reached (CLI, HTTP, or GitHub-mediated), and how branch, pull request, and test results return to the task. OpenClaw and Hermes first; Dot and Duet are tried afterwards against the same contract.

## Deferred

Deferred by the maintainer on 2026-10-30; it is not needed for the current milestone. Recorded direction for when it is picked up again: reach remote agents through webhook-style remote resources. The maintainer has already tried this outside Weaver; the notes from that trial are the starting input for the decision.
