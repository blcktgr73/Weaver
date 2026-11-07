---
id: TASK-066
type: task
title: Read the task section and fill it in on task create
requirement: REQ-010
issue: https://github.com/ebrAIn-Lab-3B/Weaver/issues/164
repository: ebrAIn-Lab-3B/Weaver
assignee_type: agent
criteria: [AC-001, AC-003, AC-006]
assignee: claude-code
---

# TASK-066 Read the task section and fill it in on task create

Tracked in [Issue #164](https://github.com/ebrAIn-Lab-3B/Weaver/issues/164). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Read and validate the `task` section, keeping today's behavior when it is absent. `weaver task create` fills the declared fields and shows them in the plan before the person confirms.

## Result

The `task` section is read by `parseProcess` ([DEC-016](../decisions/DEC-016-task-contract-in-process-file.md)); a mistake in it is an error of the section, which is ignored while the other sections apply. `weaver task create --field name=value` (repeatable) fills the declared fields: a file field goes to the front matter, a `label` mapping to an Issue label, a `project-field` mapping to a Project field set after the card is added, and `body.sections` to empty headings. The plan lists each of these. A required field with no value, a value outside `values`, or a field the contract does not declare stops the plan with a gap and creates nothing. Without the section nothing changes, and `--field` is refused.

Not in this task: comparing the fields on `reconcile` and the light card (`TASK-067`); until then a declared field in a task file is shown as an unknown field in the editor. The messages and a worked example are `TASK-068`; the reference form `task: {from: ...}` is `TASK-070`.
