# Repository Connection and Kanban v0.1

## Product decision

The first Weaver product is a traceability view over a GitHub repository, its Markdown requirements, its GitHub Issues, and its execution evidence. Weaver does not replace GitHub Issues or create a private task database in v0.1.

```text
Repository folder / clone
  → Markdown requirements
  → linked GitHub Issues
  → GitHub Project status
  → branches / commits / PRs / checks
  → Weaver Requirement Canvas + Kanban + Verification
```

The existing [PALab Ops Kanban](https://github.com/users/blcktgr73/projects/1) is the initial shared board. Weaver reads its fields and projects the relevant cards inside its own UX.

## 1. Repository connection

### VS Code

The open VS Code workspace is the initial connection context.

1. Detect the workspace's Git root.
2. Read the GitHub remote and resolve `owner/repository`.
3. Confirm the repository with the user when multiple remotes exist.
4. Load the selected GitHub Project and its Issue items.
5. Index Markdown files with `type: requirement` or `type: task` frontmatter.
6. Show the connected repository and synchronization time in the Weaver status bar.

No separate project registration is required for the local prototype. The folder is the connection boundary.

### Desktop app

The Desktop app uses the same model but makes the connection explicit:

- Open an existing local repository folder.
- Clone a GitHub repository into a selected workspace directory.
- Add another repository to a Fabric workspace.
- Select the GitHub account and Project used for task projection.
- Keep local paths and remote repository identity separate.

The Desktop app must never assume that a repository is already cloned. A connection card should show `local`, `remote`, `branch`, `last indexed`, and `access state`.

### Server, later

The Server stores workspace membership, repository registrations, permissions, and cached projections. It does not become authoritative for requirement Markdown or source code. A repository webhook or scheduled index refresh updates the projection.

## 2. Requirement-to-Issue connection

The requirement document remains the source of intent. A task is connected to a GitHub Issue through stable IDs and explicit links.

```yaml
---
id: REQ-001
type: requirement
title: Weaver manages its own development flow
story_ids: [US-001, US-004, US-007, US-010, US-012]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---
```

Task references remain inspectable in Markdown:

```markdown
- `TASK-002` Build the first VS Code Kanban projection
  - Issue: https://github.com/blcktgr73/Weaver/issues/2
  - Status: Todo
  - Owner: Unassigned
  - Evidence: pending
```

The first Issue creation flow is:

1. Select a requirement block, checklist item, or task placeholder.
2. Weaver proposes a title and body containing `REQ-###`, `US-###`, acceptance criteria, and expected evidence.
3. The user confirms creation or chooses an existing Issue.
4. Weaver writes the Issue URL and stable Task ID back to the Markdown document.
5. The Issue is added to the selected GitHub Project.

The Issue body is an execution surface. It must link back to the requirement rather than duplicate the full requirement document.

## 3. Weaver Kanban UX

### Goal

Show task movement and traceability in the same place as the requirement context. The Kanban is a derived view with explicit write-back actions.

### Board layout

```text
┌─ Repository / Project / Requirement filters ─────────────────────┐
│ Backlog │ Ready │ In Progress │ Blocked │ Review │ Verified      │
│  cards  │ cards │    cards     │ cards   │ cards  │ cards         │
└──────────────────────────────────────────────────────────────────┘
```

Each card shows:

- Task ID and title
- Requirement ID and User Story ID
- GitHub Issue state and labels
- owner and human/agent contributor
- repository and branch
- PR/check summary
- verification gap or blocker

### Interaction

- Dragging a card changes the mapped GitHub Project Status field and, when configured, the Issue status label.
- Opening a card opens the Issue detail with a right-side trace panel.
- Selecting the requirement opens the Requirement Canvas at the originating block.
- Selecting a PR, commit, or check opens the external evidence.
- A stale or missing link is shown as a gap, not silently repaired.

The board should default to the current repository and current requirement. A company-wide Fabric view is a later Desktop/Server capability.

## 4. SlashMD-style Requirement Canvas

The document surface and execution surface should be adjacent but distinct:

```text
┌──────────────────────────────┬───────────────────────────────┐
│ Markdown / SlashMD Canvas    │ Weaver Task Rail              │
│                              │                               │
│ title, blocks, criteria       │ linked Issues                 │
│ / commands, outline           │ status / owner / evidence     │
│ task placeholders             │ create / open / verify        │
└──────────────────────────────┴───────────────────────────────┘
```

The Canvas must preserve readable Markdown and Git diffs. The Task Rail is a projection and control surface; it must not hide the source document.

### Editing strategy

1. Start with a VS Code Webview panel that reads and writes the active Markdown document through the Extension Host.
2. Support a narrow block set: headings, paragraphs, lists, checklists, callouts, tables, and task blocks.
3. Add `/task`, `/acceptance`, `/decision`, and `/link-issue` commands.
4. Keep an explicit source mode for raw Markdown and a rendered block mode.
5. Run a SlashMD integration spike before coupling the full editor core to Weaver.

The first prototype does not need to reimplement every SlashMD behavior. It needs to validate the transition from a document block to an Issue and back to evidence.

## 5. Shared domain model

The domain model is shared by VS Code, Desktop, and Server:

```text
Repository
Requirement
UserStory
Task
IssueLink
Contributor
Evidence (branch / commit / PR / check / test)
VerificationRecord
```

Adapters are separate:

- `GitRepositoryAdapter`: local Git and Markdown files
- `GitHubAdapter`: Issues, Projects, pull requests, checks
- `MarkdownAdapter`: frontmatter, task blocks, source locations
- `ProjectionAdapter`: Kanban and Verification read models

The VS Code extension owns the first local adapters. Desktop reuses the domain and projection packages. Server adds cache, identity, and webhook adapters later.

## 6. v0.1 implementation slices

### Slice 1 — Connect

- Detect the active GitHub repository from the VS Code workspace.
- Show repository identity and access status.
- Load GitHub Issues and the selected existing Project.

### Slice 2 — Trace

- Index requirement Markdown.
- Parse stable Requirement, Story, and Task IDs.
- Link a task to an existing Issue.
- Open the Issue from the Requirement Canvas.

### Slice 3 — Visualize

- Render the Issue-backed Kanban inside Weaver.
- Filter by requirement, story, status, owner, and evidence gap.
- Write status changes back to the GitHub Project.

### Slice 4 — Verify

- Show linked PR, commit, checks, and tests.
- Flag missing evidence and stale links.
- Record human acceptance without automatically deciding acceptance.

### Slice 5 — Improve authoring

- Add SlashMD-style blocks and slash commands.
- Create an Issue from a selected document block.
- Add task links back into Markdown.

## Explicit non-goals

- A private Issue or Task database
- A full Jira/Linear replacement
- A new coding agent
- Real-time synchronization with every external service
- A full Markdown editor rewrite before the traceability loop is proven
