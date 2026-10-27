# PALab Weaver

**Repo-native requirements and agent execution system**

> Working name: **PALab Weaver** (`Weaver`)

PALab Weaver connects requirements, projects, tasks, people, AI agents, code, pull requests, and tests across the repositories that make up a company.

The core idea is simple:

```text
Requirement → Task → Human/Agent execution → Code/PR/Test evidence → Accepted product behavior
```

## Problem

Requirements often live in Notion or documents, tasks live in a project tracker, and implementation evidence lives in repositories and pull requests. The gap between those surfaces makes it difficult to answer:

- Which tasks were created from this requirement?
- Who or which agent owns each task?
- Where is the implementation?
- What evidence proves the task was completed?
- What still needs human judgment?

## Product direction

Weaver treats **Requirement and Task artifacts as the source of truth**. Code remains authoritative in its repository; pull requests and CI results are execution evidence. External document, project-management, Git, and agent tools are integration or collaboration surfaces.

The product language is intentionally fabric-oriented:

- **Thread:** a requirement, project, task, decision, or evidence item
- **Fabric:** the connected development context across repositories
- **Weave:** creating and maintaining relationships between threads
- **Weaver:** the system where humans and agents coordinate that work

## Current status

This repository contains the product foundation and onboarding documents. The first implementation target is a VS Code-based UX prototype for a requirement detail view.

The repository layout keeps product documents under `docs/` and implementation code under root-level application/package directories. The first code project is `apps/vscode-extension/`.

## Start here

1. Read [Development Onboarding](docs/onboarding/development-onboarding.md).
2. Read the [PALab Development Bootstrap](docs/onboarding/palab-development-bootstrap.md).
3. Read the [User Story Map](docs/product/user-story-map.md).
4. Review [REQ-001: Weaver self-hosting](docs/requirements/REQ-001-weaver-self-hosting.md).
5. Review the [GitHub Issues Integration](docs/architecture/github-issues-integration.md) and [Verification v0.1](docs/product/verification-v0.1.md).
6. Review the [Product Requirements v0.1](docs/product/requirements-v0.1.md).
7. Read the [Monorepo Structure](docs/architecture/monorepo-structure.md).
8. Read the [Repository Connection and Kanban v0.1](docs/architecture/repository-connection-and-kanban-v0.1.md).
9. Check the open issues before creating new work.

## Design principles

- Requirement and Task artifacts remain inspectable in Git.
- The same domain model must work in a VS Code extension, a Desktop app, and a Server-backed workspace.
- Local-first development is the starting point; collaboration and server synchronization are later surfaces.
- Human and AI contributors are visible participants in the same execution flow.
- The product is a development fabric, not a generic issue tracker.

## We develop Weaver with Weaver

The initial development loop is intentionally self-hosted:

```text
Weaver requirement docs
  → OpenClaw or VS Code/SlashMD editing
  → Weaver tasks
  → agent or human implementation
  → repository evidence
  → Weaver verification
```

Weaver will first manage its own development artifacts. Other PALab projects can then be connected and adopted incrementally using the same requirement, task, repository, and evidence model.

## License

License and contribution terms are not finalized yet. Do not assume that this repository is ready for external redistribution until those files are added.
