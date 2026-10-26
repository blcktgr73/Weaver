# PALab Weaver — Product Requirements v0.1

## Product statement

PALab Weaver connects the requirements and tasks of multiple company repositories and traces human and AI execution through code, pull requests, and tests.

## Core requirements

- Requirements and tasks must remain readable and versionable in Git.
- A requirement must be decomposable into tasks.
- A task must have a human or agent owner.
- A task must link to execution evidence.
- A requirement view must expose gaps, blockers, and human decisions.
- Multiple repositories must be represented in one company workspace.
- External tools may be imported or linked without becoming the only source of truth.

## Initial data shape

```yaml
type: requirement
id: REQ-001
title: Example requirement
status: in_progress
repository: product-repo
acceptance:
  - The requirement can be viewed as a document.
  - Tasks and execution evidence are visible from the requirement.
tasks:
  - TASK-001
```

```yaml
type: task
id: TASK-001
requirement: REQ-001
title: Implement requirement detail view
assignee_type: agent
assignee: codex
status: in_progress
repository: product-repo
branch: feat/req-001-detail-view
pull_request: null
tests: pending
blockers: []
```

## Initial states

`draft → ready → assigned → in_progress → review → verified → accepted`

Side states: `blocked`, `needs_human_decision`, `cancelled`.

## Definition of done

A task is not complete merely because an agent reports completion. It requires relevant implementation evidence and verification, or an explicit human-approved exception.
