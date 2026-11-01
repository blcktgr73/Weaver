---
id: TASK-028
type: task
title: Write the migration guide with this repository as the example
requirement: REQ-005
issue: https://github.com/blcktgr73/Weaver/issues/58
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-003, AC-005]
assignee: claude-code
---

# TASK-028 Write the migration guide with this repository as the example

Tracked in [Issue #58](https://github.com/blcktgr73/Weaver/issues/58). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Describe the steps from an existing process to a configuration, one part at a time, and move this repository's own process into a configuration file as the worked example.

## Progress

- [Configure how your repository tracks its work](../onboarding/configure-your-process.md) walks from "the defaults" to a process file one section at a time, with the worked example of a three-option board (HowMuchToday) and how a mistake is handled.
- This repository's [`.weaver/process.yaml`](../../.weaver/process.yaml) spells out the defaults with comments, as the reference for the field names. A test checks that it is valid and equals the defaults, so committing it changes no behavior, and that every YAML example of the guide is read without a problem.

