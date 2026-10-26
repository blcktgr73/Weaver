# PALab Development Bootstrap

This is the repeatable procedure for bringing a PALab project into Weaver's development fabric.

## Objective

Connect an existing PALab repository without taking ownership away from that repository. Weaver adds a shared view of requirements, tasks, contributors, and execution evidence while the project keeps its own Git history and source code.

## Bootstrap stages

### 1. Register

- Record the repository URL, default branch, owner, product name, and current development status.
- Record the project in Weaver's workspace configuration when that configuration exists.
- Do not move or rewrite files during registration.

### 2. Observe

- Index Markdown, YAML, issues, pull requests, branches, and test workflows in read-only mode.
- Identify existing requirement, task, decision, and evidence conventions.
- Report ambiguous or missing links as gaps; do not infer them silently.

### 3. Map

Map the project's existing artifacts to Weaver concepts:

```text
Project requirement → Requirement
Issue / checklist item → Task
Owner / agent → Contributor
Branch / commit / PR / CI result → Execution evidence
Decision / blocker → Decision or gap
```

Keep the original identifier and source URL for every mapped artifact.

### 4. Review

- Show the proposed mapping to the project owner.
- Resolve duplicate IDs, unclear ownership, and conflicting status meanings.
- Agree on which fields are authoritative in the repository and which are projections.
- Record the decision in the project or workspace documentation.

### 5. Connect

- Enable cross-repository discovery and traceability views.
- Link requirements to tasks, repositories, code locations, pull requests, and tests.
- Keep changes local to the owning repository unless the project owner approves a migration.

### 6. Adopt selectively

- Convert only approved artifacts to the repository-native Weaver format.
- Preserve history, links, and ownership when migrating.
- Validate the requirement-to-task-to-evidence chain before marking an artifact adopted.

## Weaver self-bootstrap

Weaver itself is the first PALab project in the fabric:

1. `docs/requirements/REQ-001-weaver-self-hosting.md` is the initial requirement.
2. The VS Code extension is the first execution surface.
3. OpenClaw Agent and VS Code/SlashMD are the initial contributors.
4. Commits, checks, and pull requests are the first execution evidence.
5. Friction discovered in this loop becomes a new story in the User Story Map.

## Completion checklist

- [ ] Repository identity and owner recorded
- [ ] Existing artifacts observed without mutation
- [ ] Requirement and task mapping reviewed
- [ ] Source-of-truth boundaries documented
- [ ] At least one requirement linked to a task
- [ ] At least one task linked to implementation evidence
- [ ] Remaining gaps and human decisions recorded

## Current status

The Weaver repository is in the self-bootstrap phase. The first target is local-first VS Code traceability; Desktop and Server surfaces remain planned architecture slices until the local workflow is validated.
