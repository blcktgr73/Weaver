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
- `US-014` — As a reviewer, I can tell which pull request actually implements a task, not only which pull requests mention its Issue. (Partly met: the view labels each PR "closes Issue" or "mentions Issue" from GitHub closing keywords such as `Closes #5`. Gap rules do not use the label yet.)
- `US-015` — As a first-time user, I can reach the Requirement view from the requirement file itself, without knowing which of two similarly named commands opens it. (Friction found when trying the first build: `Open Requirement` opened the source, `Show Requirement` opened the view.)
- `US-016` — As a maintainer, I can assign a task to a human or an agent from the Requirement view, and the choice is written to the task file and the GitHub Issue assignee together. (Friction found when verifying the first MVP: owners can only be typed into task front matter by hand.)
- `US-017` — As a maintainer, I can keep a roster of contributors in the repository: each entry says whether it is a human or an agent, and for an agent, which tool or model it is and how it is reached. Task owners are then picked from the roster instead of free text.
- `US-018` — As a reviewer, I can see who reviews or approves a task, separately from who implements it, and I can see that a human approved work done by an agent.
- `US-019` — As a maintainer, I can hand a task to a remote agent (for example OpenClaw or Hermes) with durable context taken from the requirement, the task file, and prior evidence, and the agent's branch, pull request, and test results come back to the task. Other agents, such as Dot and Duet, are tried the same way afterwards, so the handoff contract must not depend on one agent.
- `US-020` — As a first-time user, I can open a requirement file and see its Weaver view straight away, and I can open the matching view from other Weaver documents with one button, without it appearing on ordinary Markdown files.
- `US-021` — As a new user, I can install a released Weaver build from a GitHub Release or a registry, without building it from source.
- `US-022` — As a team lead, I can describe my team's development process (columns, label mapping, evidence rules) in the repository, and move to it one part at a time, so Weaver fits a process that differs from the one it was built with.
- `US-025` — As a team member, I open Weaver and see one Overview Kanban of every registered repository, and from a card I reach its requirement, task, evidence, and repository.
- `US-026` — As a maintainer, I can register repositories in a shared registry, clone them under one local folder, and open that folder in VS Code, so that repositories I have not opened still appear on the board.
- `US-027` — As an agent, I can read the Kanban and create, move, and annotate cards through one documented tool, and a human confirms only the moves that matter.
- `US-028` — As a user talking with an agent, a ticket I create becomes a task file, an Issue, and a Project card in one step, so it is not forgotten when the conversation moves on.
- `US-029` — As a team member, I can see stale cards on the board: idle for too long, without evidence, or waiting for a human decision.
- `US-030` — As a maintainer, I can see where repository files, Issues, and the central Project disagree, so I know what needs fixing before anything is changed automatically.
- `US-031` — As a maintainer, I can rely on a steward agent to register missing Issues and Project cards and attach evidence, so keeping the board current does not cost the team's energy.
- `US-035` — As a requirement author, I see where a requirement's tasks stand as one line of stage counts, and one action shows those cards on the Overview, so the Overview stays the only board.
- `US-036` — As a team member, I can press a card to reach its requirement at the right task, and choose the task file, the source, the Issue, a pull request, or the repository folder from a menu that says why a place cannot open. (Delivered by `TASK-033`. Friction found when first trying the board: the requirement tag was easy to miss and the card title did nothing.)
- `US-037` — As a maintainer of repositories that do not use `status:*` labels, I see their cards in the right columns on the Overview, taken from the Project board Status or another rule I configure, instead of every closed card showing as Review with a gap. (Friction found on 2026-11-01 when registering ClawHub, BookPlay-Pro, and DialogueLab: all their closed Issues were shown in Review with the gaps "no status label" and "closed without verified". HowMuchToday does the same. Belongs to `REQ-005`.)
- `US-032` — As a product person, I can draft a requirement in Notion and import it into the repository as a reviewed `REQ-###` Markdown file, so my discussion is not lost and the repository stays the source of truth.
- `US-033` — As a stakeholder who works in Notion, I can see a requirement's current status, tasks, and evidence links on its Notion page, without opening the repository.
- `US-034` — As a maintainer, I can tell which Notion page a requirement came from, and I can see when the page and the repository file have drifted apart.

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
