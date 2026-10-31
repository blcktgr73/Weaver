# DEC-007: The central Project is configuration, not a constant

- Status: accepted
- Date: 2026-10-31
- Related: `REQ-006`, [DEC-003](./DEC-003-board-status-mapping.md)

## Context

The shared board today is PALab Ops Kanban, a personal GitHub Project. The Overview Kanban of [REQ-006](../requirements/REQ-006-overview-kanban-across-repositories.md) reads a central Project. Other teams and individuals must be able to use Weaver with their own Project, whether it belongs to a person or an organization.

## Decision

1. PALab keeps using the existing PALab Ops Kanban as its central Project.
2. Weaver does not hard-code any Project. The registry file names the Project as `project: {owner, number}`, and `owner` may be a user or an organization. The code reads both in the same way.
3. A fabric has exactly one central Project. Registering another team's repositories under another Project means another registry file.
4. The getting-started guide explains how to point a registry at your own Project.

## Consequences

- No Weaver feature may assume the PALab board. PALab's own settings are an example of a registry, not a default.
- Reading a Project needs the GitHub `project` scope. Without it Weaver shows the repository and Issue view and says that the Project is unavailable (see [DEC-006](./DEC-006-closing-pr-evidence.md), item 4).
- The location of the registry file (the Weaver repository or a separate hub repository) is still open and is recorded in a later decision.
