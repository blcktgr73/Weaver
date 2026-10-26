# PALab Weaver — User Story Map

## Product goal

Help a company see how product intent becomes verified software across multiple repositories, with humans and AI agents working in the same visible flow.

## Backbone

```text
Discover intent → Shape requirements → Plan work → Execute work → Verify outcome → Learn and evolve
```

## Release 0 — Orientation and traceability foundation

### Discover intent

- As a product person, I can record the problem and desired outcome.
- As a team, we can distinguish a requirement from a task.

### Shape requirements

- As a product person, I can write a requirement as a Markdown document.
- As a developer, I can see acceptance criteria and constraints.
- As a team, we can give each requirement a stable ID.

### Plan work

- As a developer, I can split a requirement into tasks.
- As a lead, I can see task status and ownership.
- As a team, I can mark a task as blocked or needing human judgment.

### Execute work

- As a human or agent, I can claim a task.
- As a developer, I can link a task to a repository and branch.
- As an agent, I can receive the requirement context needed to work.

### Verify outcome

- As a reviewer, I can see the pull request and test evidence from the task.
- As a product person, I can see which acceptance criteria are still uncovered.
- As a team, we can distinguish reported completion from verified completion.

### Learn and evolve

- As a team, I can record decisions and unresolved gaps.
- As a contributor, I can understand how a change moved from requirement to code.

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

- Replacing Plane, Linear, Jira, or GitHub Projects as a general work-management product
- Building a proprietary coding agent
- Real-time bidirectional synchronization with every external tool
- Automatically making final product acceptance decisions without a human policy
