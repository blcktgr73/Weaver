---
id: REQ-016
type: requirement
title: User stories are written and followed on the board, not only in a document
status: draft
owner: ebrAIn.lab
story_ids: [US-051]
repository: ebrAIn-Lab-3B/Weaver
github_project: ebrAIn.lab Kanban
---

# User stories are written and followed on the board, not only in a document

## Problem

The user story map is a document. Weaver checks that a story ID looks like `US-###` and nothing more; a story is not an artifact, does not appear on the Overview, and cannot be reached from a task. The map itself is written in conversations with an agent and from links collected there, and that work is not part of the board. The path from story to requirement to task cannot be walked in one tool.

## Outcome

A story is an artifact like a requirement and a task. A person walks from a story to its requirements and tasks and back, and writes and refines the map in Weaver, with the discussions behind each story attached ([REQ-013](./REQ-013-keep-discussions-with-requirements-and-tasks.md)).

## Acceptance criteria

- A story is read as an artifact with an ID, a title, a status, its requirements, and its discussions. The decision says whether it comes from the map file or from one file per story.
- The Requirement view and the Overview let a person move from a story to its requirements and tasks and back.
- A person adds or refines a story from the editor and from the `weaver` tool, after seeing the change; the map stays readable Markdown ([DEC-008](../decisions/DEC-008-agent-identity-and-write-confirmation.md)).
- A story shows the discussions that produced it.
- A story with no requirement is shown as a gap, not an error.
- Over time, a set of links to discussions with an agent can be turned into story drafts that a person reviews one by one.

## Open decisions

- Where stories live: the existing map, or one file per story.
- How a story column on the board relates to the columns of tasks.

## Tasks

Tasks are listed here once the open decisions are recorded.

Origin: the maintainer, 2026-11-07: writing the story map is an important part of the work and is not on the board. Depends on [REQ-013](./REQ-013-keep-discussions-with-requirements-and-tasks.md).

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
