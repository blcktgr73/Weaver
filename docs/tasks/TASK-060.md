---
id: TASK-060
type: task
title: Set up the configuration from the editor and show every repository of the Project
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/125
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-003]
assignee: claude-code
---

# TASK-060 Set up the configuration from the editor and show every repository of the Project

Tracked in [Issue #125](https://github.com/blcktgr73/Weaver/issues/125). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-014](../decisions/DEC-014-user-configuration.md).

Add the editor command "Weaver: Set Up" with the same steps as `weaver init`, read the personal configuration in the Overview, and show every repository that has cards on the Project when the configuration gives no list. The Overview no longer opens by itself in every window; a command and a status bar entry open it. The clone command works with the derived list.

## Done when

- The setup works in the editor with the VS Code sign-in and writes the same file as the terminal setup.
- With no repository list, the Overview shows a lane for each repository on the Project, and the existing hide chips remove the ones a person does not want.
- The Overview opens on start only in a workspace that has a `fabric.yaml`.
- A message tells a new user to run the setup when there is no configuration.
- The editor behavior is checked by hand in the development host.
