---
id: TASK-064
type: task
title: Read the lane used last first
requirement: REQ-005
issue: https://github.com/ebrAIn-Lab-3B/Weaver/issues/155
repository: ebrAIn-Lab-3B/Weaver
assignee_type: agent
criteria: [AC-001]
assignee: claude-code
---

# TASK-064 Read the lane used last first

Tracked in [Issue #155](https://github.com/ebrAIn-Lab-3B/Weaver/issues/155). Ownership is recorded here; the Kanban column comes from the Issue.

Split from [TASK-025](TASK-025.md). [DEC-015](../decisions/DEC-015-process-configuration.md) says the Overview reads the lane the person used last before the editor closed first. Today it reads lanes in the order the person chose, top lane first, because the editor does not record which lane was used last.

Record the lane used last, and read that lane first, then the other visible lanes as before.
