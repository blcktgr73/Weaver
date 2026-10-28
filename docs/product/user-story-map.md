# PALab Weaver — User Story Map

## Product goal

Help a company see how product intent becomes verified software across multiple repositories, with humans and AI agents working in the same visible flow.

## UX and concept foundation

The User Story Map is also the product UX contract. Every story should be expressible through the following surfaces:

- **Fabric Home:** a company-level view of repositories, projects, active requirements, task movement, blockers, and recent evidence.
- **Requirement Canvas:** a Notion-like Markdown document with stable ID, metadata, acceptance criteria, linked tasks, decisions, and evidence.
- **Task Rail:** a requirement-scoped list or board showing status, owner, repository, branch, agent session, PR, tests, and human decisions.
- **Agent Workspace:** the context, plan, progress, questions, artifacts, and handoff state of an AI contributor.
- **Repository Graph:** the relationship between requirements, tasks, packages, files, commits, PRs, and tests across repositories.
- **Verification View:** the evidence and gaps needed to accept a requirement.

The visual metaphor is:

```text
Thread = Requirement / Project / Task / Decision / Evidence
Fabric = connected company development context
Weave = create and maintain relationships
Weaver = humans and agents coordinating the work
```

## Backbone

```text
Discover intent → Shape requirements → Plan work → Execute work → Verify outcome → Learn and evolve
```

## Release 0 — Orientation and traceability foundation

### Discover intent

- As a product person, I can record the problem and desired outcome.
- As a team, we can distinguish a requirement from a task.

### Shape requirements

- `US-001` — As a product person, I can write a requirement as a Markdown document.
- `US-002` — As a developer, I can see acceptance criteria and constraints.
- `US-003` — As a team, we can give each requirement a stable ID.

### Plan work

- `US-004` — As a developer, I can split a requirement into tasks.
- `US-005` — As a lead, I can see task status and ownership.
- `US-006` — As a team, I can mark a task as blocked or needing human judgment.

### Execute work

- `US-007` — As a human or agent, I can claim a task.
- `US-008` — As a developer, I can link a task to a repository and branch.
- `US-009` — As an agent, I can receive the requirement context needed to work.

### Verify outcome

- `US-010` — As a reviewer, I can see the pull request and test evidence from the task.
- `US-011` — As a product person, I can see which acceptance criteria are still uncovered.
- `US-012` — As a team, we can distinguish reported completion from verified completion.

### Learn and evolve

- As a team, I can record decisions and unresolved gaps.
- As a contributor, I can understand how a change moved from requirement to code.

### Self-development loop

- As a Weaver contributor, I can use Weaver’s own repository to manage Weaver’s requirements and tasks.
- As a contributor, I can edit Weaver requirements through OpenClaw Agent or VS Code/SlashMD.
- As a contributor, I can turn document concepts into durable tasks.
- As a human or agent, I can implement Weaver while preserving the link to the originating requirement.
- As a reviewer, I can verify Weaver changes using the same evidence model Weaver provides to other projects.
- As a contributor, I can record development friction as a product story.
- `US-013` — As a reviewer, I can see commits that are not linked to any task, so work does not land outside the requirement flow.

### PALab project adoption

- As a PALab maintainer, I can register another project repository without moving it first.
- As a contributor, I can map an existing project’s requirements and tasks to Weaver concepts.
- As a project owner, I can review the mapping before artifacts are migrated or absorbed.
- As a company, we can gradually build one connected development fabric without erasing repository ownership.

## Release 1 — VS Code requirement experience

### Discover intent

- Open a requirement from the repository.
- Browse requirements across the local workspace.

### Shape requirements

- Edit Markdown with a Notion-like block experience.
- Use `/` commands to add common requirement blocks.
- Create tasks from selected requirement content.

### Plan work

- View a requirement’s tasks as a list or board.
- Filter tasks by repository, status, owner, or agent.

### Execute work

- Start or open an agent session from a task.
- Open the related branch, repository, or development tool.

### Verify outcome

- Display PR status and CI/test status beside each task.
- Highlight missing evidence and stale links.

### Learn and evolve

- Record a decision or blocker in the requirement context.
- Show an activity trail of requirement and task changes.

## Product surfaces and architecture slices

The product is one domain model with several surfaces, not three separate products.

The first end-to-end slice is `Connect → Trace → Visualize → Verify`: connect the open repository, link Markdown requirements to GitHub Issues, render their Project status in Weaver, and expose execution evidence. The detailed interaction contract is in [Repository Connection and Kanban v0.1](../architecture/repository-connection-and-kanban-v0.1.md).

## Issue-backed execution model

In the first release, the story map is connected to GitHub Issues rather than a separate task database. A story becomes executable when it has one or more linked Issues, and a story becomes verifiable when those Issues expose implementation and test evidence. See [GitHub Issues Integration](../architecture/github-issues-integration.md) and [Verification v0.1](./verification-v0.1.md).

### Slice A — VS Code extension, local-first

- Open the current repository and index Requirement/Task artifacts.
- Provide the Requirement Canvas and Task Rail inside the editor.
- Link local branches, commits, tests, and external PRs.
- Validate frontmatter and missing traceability links.

### Slice B — Desktop app, workspace-first

- Manage multiple repositories in one company workspace.
- Provide Fabric Home, Repository Graph, and Agent Workspace views.
- Keep local repositories available offline and synchronize explicitly.
- Make the same Requirement/Task artifacts available outside VS Code.

### Slice C — Server, collaboration and project context

- Store workspace membership, project metadata, permissions, activity, and integration state.
- Index repository projections without silently replacing repository truth.
- Support shared views, comments, handoffs, and agent session history.
- Preserve an auditable link back to repository artifacts and execution evidence.

## Release 2 — Company development fabric

### Discover intent

- Import or link requirements from Notion.
- Search requirements across multiple repositories.

### Shape requirements

- Link projects and cross-repository requirements.
- Detect duplicate or conflicting requirements.

### Plan work

- Coordinate tasks across multiple repositories.
- Show dependencies and cross-repository milestones.

### Execute work

- Assign work to multiple human and AI contributors.
- Support agent handoff with durable context.

### Verify outcome

- Check requirement-to-code and requirement-to-test coverage.
- Generate a release readiness view from evidence.

### Learn and evolve

- Preserve decision history and requirement versions.
- Identify recurring gaps in the development process.

## Explicitly out of scope for the first release

- Replacing existing work-management products as a general-purpose tracker
- Building a proprietary coding agent
- Real-time bidirectional synchronization with every external tool
- Automatically making final product acceptance decisions without a human policy
- A private task database that duplicates GitHub Issues
