---
id: TASK-031
type: task
title: Read all items of the central Project
requirement: REQ-006
status: draft
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-003, AC-008]
assignee: claude-code
---

# TASK-031 Read all items of the central Project

Read every item of the central Project across registered repositories, page by page, and turn them into cards using the label mapping of DEC-003. Put the code outside the VS Code extension so a command-line tool can reuse it in REQ-007.

## Done when

- Items from several repositories come back as cards with repository, Issue, Status, and label.
- Paging works for a Project with more items than one page.
- A missing scope or an unreachable GitHub returns a typed error, not an exception.
- Tests use recorded responses.
