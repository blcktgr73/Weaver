# PALab Weaver Development Onboarding

This document is the starting procedure for a human developer or AI agent joining Weaver development.

## 1. Understand the product

Read these documents in order:

1. [README](../../README.md)
2. [User Story Map](../product/user-story-map.md)
3. [Product Requirements v0.1](../product/requirements-v0.1.md)
4. [Glossary](../product/glossary.md)

The current product hypothesis is that the missing layer is not another board. It is a visible connection between requirement intent and execution evidence.

## 2. Understand the working model

```text
Requirement
  ↓ decomposes into
Task
  ↓ assigned to
Human or AI Agent
  ↓ produces
Branch / Commit / Pull Request / Test Evidence
  ↓ verifies
Accepted Requirement
```

Requirement and Task are repository-native artifacts. Code and CI remain authoritative in their owning repositories.

## 3. Set up a worktree

Use a branch or worktree named after the requirement or task:

```bash
git fetch origin
git switch -c feat/req-001-requirement-view
```

Do not edit `main` directly.

## 4. Choose a story

Select an issue linked to a story in the User Story Map. Before coding, write or confirm:

- user and goal
- acceptance criteria
- affected repository or package
- expected evidence
- human decisions still required

## 5. Implement with evidence

During work, keep the task connected to:

- requirement ID
- branch name
- relevant commits
- pull request
- tests or manual verification
- blockers and decisions

An agent may implement code, but a human remains responsible for accepting the requirement unless the project explicitly defines another policy.

## 6. Finish the work

Before requesting review:

- run the relevant tests
- update the task state
- record the evidence
- update product documentation if the workflow changed
- explain any remaining gap

The work is complete only when the implementation and its evidence are visible from the requirement.

## 7. Current prototype scope

The first prototype is a VS Code experience that can:

- open a Markdown requirement
- show requirement metadata and acceptance criteria
- create and display tasks
- show human/agent ownership
- link branch, PR, and test evidence
- show blocked and human-decision-needed states

Not included in the first prototype: a full project-management replacement, real-time Notion synchronization, or a new coding agent.
