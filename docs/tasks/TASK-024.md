---
id: TASK-024
type: task
title: Read the configuration and keep today's behavior as the default
requirement: REQ-005
issue: https://github.com/blcktgr73/Weaver/issues/54
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-001, AC-002]
assignee: claude-code
---

# TASK-024 Read the configuration and keep today's behavior as the default

Tracked in [Issue #54](https://github.com/blcktgr73/Weaver/issues/54). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Load and validate the file in the Markdown package. With no file, every existing test must pass unchanged. Report an invalid file in the Problems panel.
