# Weaver Monorepo Structure

## Goal

Keep the domain model shared while allowing Weaver to grow from a VS Code extension into a Desktop app and a Server-backed collaboration system.

## Proposed layout

```text
Weaver/
├─ apps/
│  ├─ vscode-extension/   # VS Code commands, panels, local workspace adapter
│  ├─ desktop/             # Desktop shell and workspace experience
│  └─ server/              # Collaboration, auth, indexing, integrations
├─ packages/
│  ├─ domain/              # Requirement, Project, Task, Evidence, AgentSession
│  ├─ markdown/            # Frontmatter schema, parser, validation, projections
│  ├─ traceability/        # Link graph, coverage, gap and impact analysis
│  ├─ agent-runtime/       # Agent context, handoff, progress and evidence contracts
│  ├─ integrations/        # Git providers, Notion, project-management adapters
│  ├─ ui/                  # Shared design system and interaction components
│  └─ config/              # Shared TypeScript, lint, test and build configuration
├─ docs/
│  ├─ onboarding/
│  ├─ product/
│  ├─ architecture/
│  └─ decisions/           # Architecture and product decision records
├─ examples/               # Example repositories and requirement/task fixtures
├─ tooling/                # Repository scripts and development tooling
└─ package.json            # Workspace-level scripts only
```

The initial repository is the product’s own dogfooding workspace. It should host Weaver’s product documents, schemas, prototype code, and development evidence. Other PALab repositories remain independently owned and are connected through the Server/workspace layer when adoption begins.

## Current implementation slice

The repository starts with two active areas:

- `docs/`: product requirements, concepts, onboarding, decisions, and the User Story Map
- `apps/vscode-extension/`: the first local-first VS Code prototype

The Desktop and Server directories are architectural targets, not placeholders that must be implemented immediately. They should reuse the domain and Markdown packages once the VS Code prototype validates the model.

## Boundary rules

- `packages/domain` must not depend on VS Code, Electron, a database, or a provider SDK.
- `packages/markdown` owns the repository artifact format and validation rules.
- `packages/traceability` consumes domain entities and produces links, coverage, and gaps.
- `apps/vscode-extension` is an adapter and presentation surface, not the domain owner.
- `apps/desktop` can reuse domain, markdown, traceability, agent, and UI packages.
- `apps/server` owns collaboration state and projections, not the canonical contents of a repository artifact.
- Provider-specific code belongs under `packages/integrations`.

## Implementation order

1. Define domain types and Requirement/Task artifact schemas.
2. Build the local Markdown indexer and validator.
3. Build the VS Code Requirement Canvas and Task Rail.
4. Add Git evidence adapters for branch, commit, PR, and CI state.
5. Extract shared UI and domain packages for the Desktop app.
6. Add the Server workspace, membership, project metadata, and collaboration state.

## Repository truth versus server state

Repository artifacts are the source of truth for Requirement and Task intent. The Server may store indexes, permissions, comments, activity, integration credentials, and collaboration metadata. Server state must retain a link to the repository path and revision that it represents.

## Initial technical decision

Do not commit to a framework or package manager until the first VS Code prototype validates the data model and UX. The directory boundaries above are intentional; the implementation tooling can be selected in the first technical spike.
