---
id: REQ-005
type: requirement
title: Teams describe their own development process and adopt it step by step
status: draft
owner: PALab
story_ids: [US-022]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# Teams describe their own development process and adopt it step by step

## Problem

Weaver encodes one process: fixed Kanban columns, `status:*` labels, a rule that Verified needs a closing pull request, and fixed ID formats. A team that works differently (an extra QA column, other label names, verification without a pull request) cannot use Weaver without changing its code.

## Outcome

A repository describes its process in a file kept in Git. Weaver follows it, behaves as it does today when no file exists, and a team can move to the configuration one part at a time.

## Acceptance criteria

- A repository can describe its process (columns, label mapping, evidence rules) in a configuration file kept in Git.
- Without a configuration file, Weaver behaves exactly as it does today.
- A team can adopt one part of the configuration at a time, for example columns first and evidence rules later, and each step is visible in the view.
- The view shows which parts of the process come from the configuration and which are defaults.
- A migration guide takes a team from its existing process to a configuration, with this repository as the worked example.

## Tasks

- `TASK-023` Decide the process configuration format — [GitHub Issue #53](https://github.com/blcktgr73/Weaver/issues/53)
- `TASK-024` Read the configuration and keep today's behavior as the default — [GitHub Issue #54](https://github.com/blcktgr73/Weaver/issues/54)
- `TASK-025` Drive columns and label mapping from the configuration — [GitHub Issue #55](https://github.com/blcktgr73/Weaver/issues/55)
- `TASK-026` Drive evidence and verification rules from the configuration — [GitHub Issue #56](https://github.com/blcktgr73/Weaver/issues/56)
- `TASK-027` Show which parts of the process are configured and which are defaults — [GitHub Issue #57](https://github.com/blcktgr73/Weaver/issues/57)
- `TASK-028` Write the migration guide with this repository as the example — [GitHub Issue #58](https://github.com/blcktgr73/Weaver/issues/58)

The file format is decided in `TASK-023` before any code reads it. The first code step (`TASK-024`) must not change behavior.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
