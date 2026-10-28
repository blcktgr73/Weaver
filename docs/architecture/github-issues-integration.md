# GitHub Issues Integration v0.1

GitHub Issues is Weaver's first execution system. Weaver does not create a second task database in v0.1. It reads and writes GitHub Issues, while repository Markdown remains the source of requirement intent and acceptance criteria.

The initial shared Kanban projection is the existing [PALab Ops Kanban](https://github.com/users/blcktgr73/projects/1). Weaver issues are added to that board; Weaver does not create a project-specific board until a future product decision requires one.

## Authority boundaries

```text
Requirement Markdown      → intent, constraints, acceptance criteria
GitHub Issue               → task execution state, assignee, discussion
Branch / commit / PR      → implementation evidence
Checks / test reports     → verification evidence
Weaver views              → derived Kanban, story map, and verification views
```

An Issue is a task projection linked to a requirement. It is not allowed to silently replace the requirement document.

## Required links

Every Weaver-managed Issue should include:

- `Requirement: REQ-###` and a repository path or URL
- `Story: US-###` when the work belongs to a User Story Map story
- acceptance criteria or a link to the requirement's acceptance criteria
- owning repository or package
- expected evidence: branch, pull request, checks, tests, or manual verification
- human decision or blocker, if applicable

Use stable IDs in the Issue title or body:

```text
[TASK-###] short execution goal
```

## Status mapping

Weaver normalizes GitHub Issue state and labels into a small Kanban model. The full mapping from lifecycle status to these columns is in [Product Requirements v0.1](../product/requirements-v0.1.md#status-mapping):

```text
Backlog    → open + status:backlog
Ready      → open + status:ready
In progress → open + status:in-progress
Blocked    → open + status:blocked
Review     → open + status:review
Verified   → closed + status:verified
```

GitHub's open/closed state remains visible. A closed Issue without verification evidence is not considered complete; the view must flag it as a verification gap.

## Kanban projection

The first Kanban view is derived from Issues and their linked evidence:

- columns are the normalized statuses above
- cards show task ID, requirement ID, story ID, owner, repository, and latest evidence
- filters include requirement, User Story Map activity, repository, owner, human/agent contributor, and evidence gap
- moving a card updates the Issue labels and state through an explicit action
- every mutation is reviewable through the Issue timeline

The view should not copy Issue data into a private database in v0.1. A local cache is permitted for indexing, but GitHub remains the task authority.

## User Story Map projection

Each story in `docs/product/user-story-map.md` may link to one or more Issues. The view groups Issues by:

1. backbone activity
2. release slice
3. story ID
4. task status

This makes the map an executable plan instead of a static document.

## Verification projection

For each requirement, Weaver computes a traceability chain:

```text
Requirement → Story → Issue/Task → PR or commit → checks/tests → acceptance decision
```

The verification view reports:

- covered acceptance criteria
- tasks without an owner
- tasks without a linked branch, commit, or PR
- PRs without passing checks
- closed Issues without evidence
- unresolved blockers and human decisions
- stale or broken links

The view reports gaps; it does not make the final product acceptance decision automatically.

## Later evolution

A server-side project-management database may be added for workspace membership, cross-repository indexing, permissions, and cached projections. It must preserve GitHub Issue history and repository artifacts and must not become an invisible second source of truth.
