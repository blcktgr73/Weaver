---
id: TASK-035
type: task
title: List mismatches between files, Issues, and the Project
requirement: REQ-006
status: draft
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-006]
assignee: claude-code
---

# TASK-035 List mismatches between files, Issues, and the Project

Find task files without an Issue, Project cards without a task file, broken Issue links, merged pull requests not linked to their task, and board Status that disagrees with the label. Report only; change nothing.

## Done when

- Each of the five kinds is detected by a pure function with tests.
- The Overview lists them with the card or file involved.
