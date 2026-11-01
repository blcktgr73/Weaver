---
id: TASK-056
type: task
title: Prepare the first dogfooding round with a feedback intake and a checklist
requirement: REQ-001
issue: https://github.com/blcktgr73/Weaver/issues/118
repository: blcktgr73/Weaver
assignee_type: agent
assignee: claude-code
---

# TASK-056 Prepare the first dogfooding round with a feedback intake and a checklist

Tracked in [Issue #118](https://github.com/blcktgr73/Weaver/issues/118). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Weaver is developed with its own workflow (AGENTS.md). Prepare the first round of using it for real: a place where feedback is received as a requirement-shaped record, and a short checklist for the people taking part.

## Done when

- An Issue form lets a participant report friction with what they were doing, what they expected, and what happened.
- The guide says how a report becomes a story in the user story map and, when it needs work, a task.
- A checklist for the first round covers install, opening the Overview, and the first requirement view.
- It is written for colleagues who did not build Weaver and who work in a shared project: a colleague installs a Release, runs the setup, and sees the Overview of that project without a configuration beyond the setup.

## Progress

- Added the Issue form `.github/ISSUE_TEMPLATE/dogfooding-feedback.yml` (what you were doing, what you expected, what happened, how much it got in the way, where), and the guide [First round of using Weaver for real](../onboarding/dogfooding-round-1.md): a checklist for a colleague (install a Release, run the setup, open the Overview, open a requirement view) and the maintainer's steps from a report to a story, a requirement, and a task.
- A test checks the form's required fields and that the guide links to it. The form was not opened on GitHub yet, and the label `dogfooding` it sets does not exist in the repository until someone creates it (GitHub ignores a label that does not exist).

