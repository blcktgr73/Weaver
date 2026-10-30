# PALab Weaver — Artifact Schema v0.1

This is the single reference for the repository-native Requirement and Task artifacts. The validator in `packages/markdown` implements exactly this document. The schema is versioned with the repository; change it through a pull request.

## Principles

- Frontmatter holds **metadata**. The Markdown body holds **content** (acceptance criteria, task list) so the document stays readable and diffs stay meaningful.
- Every link is a plain ID or URL that a human can follow in Git.
- Unknown frontmatter fields are allowed and preserved. The validator reports unknown fields only as informational notes.
- Status values follow [DEC-001](../decisions/DEC-001-status-vocabulary.md).

## Identifiers

| Kind | Pattern | Example |
| --- | --- | --- |
| Requirement | `REQ-` + 3 or more digits | `REQ-001` |
| Task | `TASK-` + 3 or more digits | `TASK-005` |
| User story | `US-` + 3 or more digits | `US-013` |
| Repository | `owner/name` | `blcktgr73/Weaver` |

IDs are unique within a workspace and are never reused.

## Requirement artifact

A Markdown file with frontmatter `type: requirement`.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `REQ-###` | |
| `type` | yes | `requirement` | |
| `title` | yes | string | |
| `status` | yes | lifecycle status | see below |
| `owner` | no | string | person, team, or agent |
| `story_ids` | no | list of `US-###` | |
| `repository` | no | `owner/name` | owning repository |
| `github_project` | no | string | project used for the Kanban projection |

Body sections (heading text is matched case-insensitively):

- `## Acceptance criteria` — a Markdown list. Each item is one criterion. Weaver numbers them `AC-001`, `AC-002`, … in order.
- `## Tasks` — a Markdown list. Each item has the form:

  ```markdown
  - `TASK-005` Short title — [GitHub Issue #5](https://github.com/owner/name/issues/5)
  ```

  The Issue link is optional. A task without a link is reported as a gap by the verification view, not as a schema error.

## Task artifact

A task normally lives as a GitHub Issue plus a line in the requirement's `## Tasks` list. A task file is optional and uses frontmatter `type: task`. It carries what the list cannot: the owner, the acceptance criteria the task satisfies, and blockers ([DEC-005](../decisions/DEC-005-task-files.md)). Task files live under `docs/tasks/`.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | yes | `TASK-###` | |
| `type` | yes | `task` | |
| `title` | yes | string | |
| `requirement` | yes | `REQ-###` | must exist in the workspace |
| `status` | yes, unless `issue` is set | lifecycle status | with an `issue` link the Issue decides the column ([DEC-003](../decisions/DEC-003-board-status-mapping.md)) |
| `assignee_type` | no | `human` or `agent` | |
| `assignee` | no | string | |
| `repository` | no | `owner/name` | |
| `branch` | no | string | |
| `pull_request` | no | URL or `null` | |
| `issue` | no | URL | |
| `tests` | no | string | e.g. `pending`, a command, or a check URL |
| `blockers` | no | list of strings | |
| `criteria` | no | list of `AC-###` | acceptance criteria of the requirement that this task satisfies |

## Lifecycle status

`draft`, `ready`, `assigned`, `in-progress`, `review`, `verified`, `accepted`, `blocked`, `needs-human-decision`, `cancelled`.

The mapping to Kanban columns is in [Product Requirements v0.1](./requirements-v0.1.md#status-mapping).

## Validation rules

Errors (the artifact is invalid):

1. Frontmatter is present and parses as YAML.
2. `type` is `requirement` or `task`.
3. Required fields are present and non-empty.
4. `id`, `story_ids`, `requirement`, `criteria`, and `repository` match their patterns.
5. `status` and `assignee_type` use allowed values.
6. The ID prefix matches the type (`REQ-` for requirements, `TASK-` for tasks).

Workspace-level errors:

7. IDs are unique across all artifacts.
8. A task file's `requirement` refers to an existing requirement.
9. A task ID is listed under at most one requirement's `## Tasks`.

Warnings (shown, but not invalid):

10. A requirement has no `## Acceptance criteria` items.
11. A requirement has no `## Tasks` items.
12. A task listed under `## Tasks` has no Issue link.
13. A `## Tasks` list item does not start with a `TASK-###` ID.
14. A task file is not listed under its requirement's `## Tasks`.
15. A task file's `criteria` names a criterion the requirement does not have.
