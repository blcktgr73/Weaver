# Weaver Self-development Loop

## Purpose

Weaver should validate its own product model while it is being built. The first customer is the Weaver project itself.

## Development loop

```text
1. Express intent
   Requirement, concept, decision, acceptance criteria
          ↓
2. Shape work
   Task decomposition, owner, dependencies, open questions
          ↓
3. Execute
   OpenClaw Agent, VS Code/SlashMD, human developer, or another PALab agent
          ↓
4. Capture evidence
   Files, branch, commits, PR, tests, screenshots, review decisions
          ↓
5. Verify
   Requirement coverage, task state, blockers, human acceptance
          ↓
6. Improve Weaver
   Friction becomes a new requirement or User Story
```

## Editing surfaces

### OpenClaw Agent

Use the agent to explore requirements, inspect repository state, coordinate bounded work, and record durable decisions. Agent conversation alone is not the final artifact; the resulting requirement, task, decision, or implementation must be committed to the repository or linked as evidence.

### VS Code and SlashMD

Use VS Code/SlashMD as the document-first editing surface for Markdown requirements. The initial prototype should make it easy to move from a document block to a task while keeping the source file readable in Git.

### Repository

The repository stores durable product intent and task state. A change should remain understandable to a contributor who never saw the original chat or editor session.

## PALab project adoption strategy

PALab projects are adopted in stages:

1. **Register:** add the repository to the Weaver workspace.
2. **Observe:** index existing documents, tasks, branches, PRs, and tests without mutation.
3. **Map:** propose relationships between existing artifacts and Weaver concepts.
4. **Review:** let the project owner approve or correct the mapping.
5. **Connect:** display the project in the shared Fabric and link new evidence.
6. **Migrate selectively:** move or normalize artifacts only when ownership and history remain clear.

Weaver must not require every PALab project to become one physical repository. The company Fabric is a logical workspace over repository-owned artifacts.

## Dogfooding acceptance criteria

The self-development loop is useful when:

- a contributor can find the requirement behind a Weaver change;
- an agent receives durable context without relying on a private conversation;
- a reviewer can see code and test evidence from the task;
- friction in the loop produces a concrete product story;
- another PALab project can be connected without an unsafe bulk migration.
