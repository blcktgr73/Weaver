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

The authoritative field list and validation rules are in [Artifact Schema v0.1](./artifact-schema-v0.1.md). The examples below are illustrative. In the schema, acceptance criteria and the task list live in the Markdown body, not in frontmatter.

```yaml
type: requirement
id: REQ-001
title: Example requirement
status: in-progress
repository: product-repo
```

```yaml
type: task
id: TASK-001
requirement: REQ-001
title: Implement requirement detail view
assignee_type: agent
assignee: codex
status: in-progress
repository: product-repo
branch: feat/req-001-detail-view
pull_request: null
tests: pending
blockers: []
```

## Initial states

Status values are lowercase and hyphenated (see [DEC-001](../decisions/DEC-001-status-vocabulary.md)).

`draft → ready → assigned → in-progress → review → verified → accepted`

Side states: `blocked`, `needs-human-decision`, `cancelled`.

## Status mapping

The lifecycle status lives in Markdown frontmatter. The Kanban column is a GitHub Issue projection of it. This table is the single reference; other documents link here.

| Lifecycle status (frontmatter) | Kanban column | GitHub Issue state + label |
| --- | --- | --- |
| `draft` | Backlog | open + `status:backlog` |
| `ready`, `assigned` | Ready | open + `status:ready` |
| `in-progress` | In progress | open + `status:in-progress` |
| `blocked`, `needs-human-decision` | Blocked | open + `status:blocked` |
| `review` | Review | open + `status:review` |
| `verified`, `accepted` | Verified | closed + `status:verified` |
| `cancelled` | not shown | closed |

Notes:

- `assigned` and `needs-human-decision` have no column of their own. The card shows the owner or the pending decision instead.
- `accepted` is a human decision recorded in the requirement or verification record. The Issue only reaches `verified`.
- A closed Issue without verification evidence is a verification gap, whatever its label says.

## Definition of done

A task is not complete merely because an agent reports completion. It requires relevant implementation evidence and verification, or an explicit human-approved exception.
