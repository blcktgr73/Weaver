# PALab Weaver — Verification v0.1

## Purpose

Verification answers one question:

> Can a human follow this requirement from intent to task, implementation evidence, and an accepted result?

The first version is a documentation and GitHub Issues workflow. It is not an automated quality gate and does not replace human review.

## Verification record

Each requirement should expose or link to these fields:

```yaml
requirement_id: REQ-001
story_ids: [US-001]
task_ids: [TASK-001]
acceptance_criteria:
  - id: AC-001
    text: Requirement is stored as readable Markdown.
    status: covered
    evidence:
      - path: docs/requirements/REQ-001-weaver-self-hosting.md
tasks:
  - id: TASK-001
    issue: https://github.com/blcktgr73/Weaver/issues/1
    owner: human-or-agent
    status: in-progress
    evidence:
      - type: commit
        ref: commit-sha
      - type: test
        ref: command-or-check-url
decisions: []
gaps: []
```

The exact YAML schema remains provisional. The important property is that every link is inspectable and can be reviewed in Git.

## Evidence levels

- **Intent recorded:** requirement and acceptance criteria exist.
- **Task planned:** each acceptance slice has an Issue or explicit reason why not.
- **Execution linked:** the task has an owner and repository execution reference.
- **Implementation evidenced:** a commit or pull request changes the owning repository.
- **Verification evidenced:** checks, tests, or documented manual verification are linked.
- **Accepted:** a human or agreed project policy confirms the acceptance criteria.

Do not collapse these levels into a single “done” flag.

## Verification checklist

For each release slice:

- [ ] requirement has a stable ID
- [ ] User Story Map story is identified
- [ ] acceptance criteria are explicit
- [ ] each criterion maps to a task or an intentional omission
- [ ] every task has an owner
- [ ] every implementation task has a repository and branch/commit/PR link
- [ ] tests or manual verification are recorded
- [ ] blockers and human decisions are visible
- [ ] acceptance is recorded by a human or declared policy

## Initial Weaver verification

`REQ-001` is the first dogfooding target. The first successful verification run should prove:

1. Markdown requirement exists in the repository.
2. GitHub Issues can represent its tasks.
3. The Kanban projection can show task movement.
4. Code and test evidence can be linked back to a task.
5. The remaining traceability gaps are visible from a single requirement view.
