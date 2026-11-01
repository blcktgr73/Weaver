---
id: TASK-054
type: task
title: Attach the weaver tool to the release
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/116
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-006]
assignee: claude-code
---

# TASK-054 Attach the weaver tool to the release

Tracked in [Issue #116](https://github.com/blcktgr73/Weaver/issues/116). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

The tool can only be used from a checkout. Bundle it into one file and attach it to the GitHub Release next to the VSIX, so that a teammate or an agent can run it with Node alone. Keep the tool out of the VSIX.

## Done when

- The release workflow builds a single `weaver.js` that runs with Node 20 or later and attaches it to the Release.
- The agent contract and the getting-started guide say how to download and run it.
- A test or a workflow step runs the bundled file (`--help`) before it is attached.
