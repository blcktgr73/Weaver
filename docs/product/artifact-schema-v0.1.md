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
| Repository | `owner/name` | `ebrAIn-Lab-3B/Weaver` |

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
  owner: ebrAIn-Lab-3B        # a user or an organization login
  number: 1
repositories:
  - ebrAIn-Lab-3B/Weaver
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
  owner: ebrAIn-Lab-3B
  number: 1
repositories:            # optional; without it, every repository with cards on the Project is shown
  - ebrAIn-Lab-3B/Weaver
  - repository: blcktgr73/HowMuchToday
    title: How much today
roster:                  # optional; see "Contributor roster" for the entries
  contributors:
    - id: blcktgr73
      kind: human
```

`project` and `repositories` follow the rules of the fabric registry; a workspace `fabric.yaml` overrides them for that workspace. `roster` always comes from this file.

## Contributor roster

The `roster` entry of the [user configuration](#user-configuration) lists the people and agents that tasks can be given to ([DEC-013](../decisions/DEC-013-contributor-roster.md)). It is not committed.

```yaml
roster:
  contributors:
    - id: maria            # the name task files use
      kind: human        # human | agent
      github: maria-dev  # optional; becomes the Issue assignee for a human
    - id: claude-code
      kind: agent
      tool: Claude Code  # for an agent: the tool or product
      model: opus        # optional
      reach: runs in the maintainer's session
```

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | The name used in task files. Letters, digits, spaces, and `. _ @ -`. Unique without regard to case. |
| `kind` | yes | `human` or `agent`. |
| `name` | no | A display name. |
| `github` | no | The GitHub login. |
| `tool`, `model`, `reach` | agents | Which tool or model it is, and how it is reached. A missing `tool` or `reach` is a warning. |

### Three layers and the shared roster

[DEC-017](../decisions/DEC-017-shared-roster-by-reference.md) adds two layers to the party fields above, and lets an organization provide the roster from a repository it owns.

```yaml
contributors:
  - id: reviewer-agent        # party: who
    kind: agent
    tool: Claude Code
    roles: [reviewer]         # role: what it can take; plain strings, the meaning is the organization's
    reach:                    # reach: how work gets to it; one entry or a list
      - type: label
        value: dispatch:reviewer-agent
```

| Field | Meaning |
| --- | --- |
| `roles` | A list of plain strings. Weaver matches a task or a rule to a role; it defines none. |
| `reach` | `{type, value}` or a list of them. Weaver acts only on `type: label` (the label is added to the Issue). Another type is kept and shown, not acted on. A plain string is read as `{type: text, value}`. |

Nodes, channel ids, tokens, and other instance details are not part of the schema. A field outside the schema is kept, not read, and reported as a warning.

### The roster file

The file a roster is kept in is a YAML mapping with one key, `contributors`, a list of the entries above. [`examples/roster.example.yaml`](../../examples/roster.example.yaml) is a commented sample to copy.

- An organization keeps the file in a repository it owns (for example `roster.yaml` at the root of an `agents` repository) and points to it with `roster.from`. Weaver reads it and never writes to it; a change is a pull request.
- Each `id` is unique without regard to case, and each `kind` is `human` or `agent`. A list with no entry, or an entry without `id` or `kind`, is an error of the file; the other problems (an agent without `tool`, a field outside the schema) are warnings.
- Instance details (node addresses, channel ids, tokens) do not belong in it.
- The editor adds, changes, and removes an entry ([TASK-075](../tasks/TASK-075.md)): **Weaver: Add or Change Contributors**, also in the Weaver view and the Overview menu. It writes either to the personal roster or to a roster file the person picks in a local clone, after showing the change. Only that entry changes; the comments of the file and the other entries stay. It never writes to a referenced repository, so a change to a shared roster is committed and reviewed by the person in the repository that owns it.

A reference names the file that holds a shared roster: `{repository, path, ref}`, where `ref` defaults to the default branch.

```yaml
# .weaver/process.yaml of a repository (a personal config may hold one `roster.from` too; this one wins)
roster:
  from: {repository: my-org/agents, path: roster.yaml, ref: main}
task:
  from: {repository: my-org/agents, path: task-contract.yaml}   # the profile of REQ-010; a section written in place wins field by field
```

Weaver reads the file through GitHub with the person's token, keeps the last text on the person's computer with its `ETag`, shows its age, and works from it when offline. It never writes to the referenced repository. A missing, unreadable, or partly invalid file gives gaps and warnings, not errors. A personal `roster.contributors` is an overlay: the same id (without regard to case) overrides the fields it sets, an id only in it is added, and it never removes a referenced contributor.

A task file may also name `reviewer`, `approved_by`, and `approved_on`. With a roster, an owner, reviewer, or approver that is not in it, an approver that is an agent, and Verified agent work without a human approval are shown as gaps.
