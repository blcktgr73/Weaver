---
id: TASK-073
type: task
title: Read the workspace files on refresh and when files change on disk
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/172
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-016]
assignee: claude-code
---

# TASK-073 Read the workspace files on refresh and when files change on disk

Tracked in [Issue #172](https://github.com/blcktgr73/Weaver/issues/172). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Friction found on 2026-11-05 while adopting Weaver in palab-platform: files were added to `docs/requirements/` and `docs/tasks/` outside the editor, and the refresh button of the Overview did not show them. It read only the Project cards again. The workspace files were re-read only when a Markdown document was saved in the editor, so a person had to run **Developer: Reload Window**.

- The refresh button of the Overview and the `weaver.refreshOverview` command read the workspace files before they read the Project.
- A change on disk to a Markdown file or to `.weaver/process.yaml` (made by an agent, `git checkout`, or another tool) re-reads the workspace without a button press. Many changes in a short time (a branch switch) are gathered into one read.
