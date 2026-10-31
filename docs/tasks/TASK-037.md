---
id: TASK-037
type: task
title: Show a read-only board when GitHub is unreachable
requirement: REQ-006
status: draft
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-007]
assignee: claude-code
---

# TASK-037 Show a read-only board when GitHub is unreachable

Build the board from repository files only when GitHub cannot be reached, and say that the state is not current.

## Done when

- The fallback board appears without a network.
- A visible notice says the state may be out of date.
