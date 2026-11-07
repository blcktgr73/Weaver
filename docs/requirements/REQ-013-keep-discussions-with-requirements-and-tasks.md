---
id: REQ-013
type: requirement
title: Discussions stay attached to the requirement, task, and story they shaped
status: draft
owner: ebrAIn.lab
story_ids: [US-048]
repository: ebrAIn-Lab-3B/Weaver
github_project: ebrAIn.lab Kanban
---

# Discussions stay attached to the requirement, task, and story they shaped

## Problem

The talk that shapes a requirement is scattered: chats with an agent, threads in a team chat (Discord, Slack), meetings. The user story map, the requirements, and the tasks are linked to each other, but not to the conversations behind them. When a task is worked on, more talk happens, and that is lost too. Months later the decision is in the code and nobody can say why. This is where the pain of the team starts.

## Outcome

Each story, requirement, and task can point to the discussions that shaped it, and the substance of each discussion (what was decided, why, and what is still open) is kept in the repository. A person reading a requirement sees the talk behind it and behind its tasks, in one place.

## Acceptance criteria

- A story, requirement, and task can list `discussions`. An entry has a kind (a free string such as `discord`, `slack`, `agent-session`, `meeting`), an address or a reference, a date, the participants, and the path of its digest.
- The substance is a **digest**, a Markdown file in the repository (for example `docs/discussions/DISC-###.md`) with the decisions, the reasons, the open questions, and a link to the original. Its form is fixed in the artifact schema.
- A person chooses what is recorded. Weaver never records a conversation on its own and never reads from a chat service. Keeping the original (a transcript or an export) is optional and also the person's choice; where it goes (a path on the computer, a link, or the repository) is the person's choice.
- Before a digest is saved, text that looks like a secret (a token, a key, a password) is shown for review, and the person decides.
- The Requirement view shows the discussions of the requirement together with those of its tasks, newest first. Each opens its digest or its link.
- A person, or an agent at the end of a conversation, can add a discussion from the editor or with `weaver discussion add`. The write is confirmed as every write is ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)).
- A proposal links to its discussions the same way, so `Origin: proposal` and a discussion are one mechanism.
- The `Related thread` card field of a task contract ([DEC-016](../decisions/DEC-016-task-contract-in-process-file.md)) stays a card field and may point to a digest.
- An organization's process can say which kinds it uses and whether a discussion is required. No organization's name or tool appears in code, schema, or tests.
- Artifacts without `discussions` keep working; a missing list means none.

## Open decisions

- The ID scheme and folder of digests, and whether a digest may belong to several artifacts.
- How an agent session is exported to a digest without copying the whole transcript.
- Whether a story of the story map carries discussions in its own entry or through [REQ-016](./REQ-016-user-stories-on-the-board.md).

## Tasks

Tasks are listed here once the open decisions are recorded.

Origin: the maintainer named this as the starting point of the team's pain on 2026-11-07. The talk that led to this requirement is itself not recorded anywhere yet.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
