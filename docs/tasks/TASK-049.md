---
id: TASK-049
type: task
title: Write the agent contract for the weaver tool
requirement: REQ-007
issue: https://github.com/blcktgr73/Weaver/issues/100
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-006]
assignee: claude-code
---

# TASK-049 Write the agent contract for the weaver tool

Tracked in [Issue #100](https://github.com/blcktgr73/Weaver/issues/100). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)). The approach is [DEC-012](../decisions/DEC-012-steward-first-version.md).

Write `docs/onboarding/agent-contract.md`: the commands, the JSON shapes, the exit codes, the confirmation rule, and the identity rule, so that any agent that can run a shell command can use the tool without a product-specific adapter ([US-019](../product/user-story-map.md)).

## Done when

- The document lists every command with an example input and output.
- It states how an agent hands a conversation ticket to `weaver task create`.
- It states what an agent must never do, matching DEC-008.
- The examples are run by a test so they cannot drift from the tool.
