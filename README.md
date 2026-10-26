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

Weaver treats **Requirement and Task artifacts as the source of truth**. Code remains authoritative in its repository; pull requests and CI results are execution evidence. Plane, Linear, Notion, GitHub, and agent tools are integration or collaboration surfaces.

The product language is intentionally fabric-oriented:

- **Thread:** a requirement, project, task, decision, or evidence item
- **Fabric:** the connected development context across repositories
- **Weave:** creating and maintaining relationships between threads
- **Weaver:** the system where humans and agents coordinate that work

## Current status

This repository contains the product foundation and onboarding documents. The first implementation target is a VS Code-based UX prototype for a requirement detail view.

## Start here

1. Read [Development Onboarding](docs/onboarding/development-onboarding.md).
2. Read the [User Story Map](docs/product/user-story-map.md).
3. Review the [Product Requirements v0.1](docs/product/requirements-v0.1.md).
4. Check the open issues before creating new work.

## Reference products

Weaver takes inspiration from:

- Plane: structured work management, work items, integrations, and self-hosting
- Linear: project overview → issue → human/agent execution experience
- GitHub: repository, pull request, and CI evidence

Weaver is not intended to be another generic issue tracker. Its initial focus is traceability across repository-native requirements and execution.

## License

License and contribution terms are not finalized yet. Do not assume that this repository is ready for external redistribution until those files are added.
