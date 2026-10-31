---
id: TASK-034
type: task
title: Set a fabric root folder and clone the missing repositories
requirement: REQ-006
status: draft
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-002]
assignee: claude-code
---

# TASK-034 Set a fabric root folder and clone the missing repositories

Let each user set a local fabric root that is not shared, clone every registered repository that is missing under it, and open the folder in VS Code.

## Done when

- Existing clones are skipped and never overwritten.
- The root path is stored locally and never in the repository.
- A clone failure for one repository does not stop the others and is reported.
