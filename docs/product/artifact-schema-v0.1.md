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
| `accepted_by` | no | string | who recorded acceptance; written by the view's **Record acceptance** action |
| `accepted_on` | no | date string | when acceptance was recorded |

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
| `evidence_exception` | no | string | a human-approved reason to accept the task without complete evidence ([DEC-006](../decisions/DEC-006-closing-pr-evidence.md)) |
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

## Fabric registry (the optional shared file)

A workspace may keep a `fabric.yaml` for a team that wants everyone to see the same Project and repositories; a person's own configuration is [`~/.weaver/config.yaml`](#user-configuration) ([DEC-014](../decisions/DEC-014-user-configuration.md)). `fabric.yaml` lists the repositories that appear on the Overview Kanban and the central GitHub Project they report to ([DEC-007](../decisions/DEC-007-central-project-is-configuration.md), [DEC-010](../decisions/DEC-010-fabric-registry-location.md)). It is a plain YAML file, not Markdown with frontmatter. It sits at the root of the repository that owns the fabric, and the parser takes its path without assuming where it is.

```yaml
project:
  owner: blcktgr73        # a user or an organization login
  number: 1
repositories:
  - blcktgr73/Weaver
  - repository: blcktgr73/HowMuchToday
    title: How much today # optional label for the lane
```

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `project.owner` | yes | GitHub login | user or organization that owns the Project |
| `project.number` | yes | integer, 1 or more | Project number in its URL |
| `repositories` | yes | non-empty list | each entry is `owner/name` or `{repository, title?}` |

The order of `repositories` is the default lane order. Rules:

- Errors: the file is not valid YAML or not a mapping; `project`, `project.owner`, `project.number`, or `repositories` is missing or has the wrong type; the owner is not a valid login; the number is not a whole number of 1 or more; `repositories` is empty; an entry is not `owner/name` or lacks `repository`; a repository is listed twice (names are compared without case).
- Warnings: an unknown field is kept but not interpreted.
- The registry is returned only when there are no errors.

## User configuration

`~/.weaver/config.yaml` is a person's own configuration, read by the editor and the `weaver` tool ([DEC-014](../decisions/DEC-014-user-configuration.md)). `WEAVER_HOME` moves the folder. It is never committed.

```yaml
project:
  owner: blcktgr73
  number: 1
repositories:            # optional; without it, every repository with cards on the Project is shown
  - blcktgr73/Weaver
  - repository: blcktgr73/HowMuchToday
    title: How much today
roster:                  # optional; see "Contributor roster" for the entries
  contributors:
    - id: blcktgr73
      kind: human
```

`project` and `repositories` follow the rules of the fabric registry; a workspace `fabric.yaml` overrides them for that workspace. `roster` always comes from this file.
