# AGENTS.md — PALab Weaver

## Mission

Keep requirements, tasks, and implementation evidence connected across the repositories that form a company’s development fabric.

## Source-of-truth policy

- Requirement intent and acceptance criteria live in repository artifacts.
- Task definitions and ownership live in repository artifacts.
- Source code is authoritative in its owning repository.
- Pull requests and CI results are evidence of execution and verification.
- External tools are projections, collaboration surfaces, or integrations unless a decision explicitly says otherwise.

## Development workflow

1. Start from a requirement or user story.
2. Define acceptance criteria before implementation.
3. Break the work into small, verifiable tasks.
4. Assign each task to a human or agent.
5. Link code, branch, pull request, and tests to the task.
6. Record blockers and human decisions explicitly.
7. Verify the result and update the requirement status.

## Contribution rules

- Keep changes small and reviewable.
- Prefer Markdown/YAML artifacts that remain readable in Git.
- Do not hide important state only in an external service.
- Do not mark work complete without evidence or an explicit exception.
- Update the relevant product document or story map when behavior changes.
- Add tests with implementation work whenever practical.

## Naming

- Product: PALab Weaver
- Short name: Weaver
- Requirement: `REQ-###`
- Task: `TASK-###`
- User story: `US-###`

## Before opening a pull request

- Confirm the linked requirement and task.
- Describe the implementation evidence.
- List tests run and their result.
- Call out unresolved decisions or blockers.
- Update documentation when the workflow or data model changes.
