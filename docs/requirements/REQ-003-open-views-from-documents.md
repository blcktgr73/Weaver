---
id: REQ-003
type: requirement
title: Weaver views open from the documents themselves
status: draft
owner: PALab
story_ids: [US-015, US-020]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# Weaver views open from the documents themselves

## Problem

A user who opens a requirement file sees raw Markdown and must find a command to reach the Weaver view. Two similarly named commands already confused the first user.

## Outcome

Opening a requirement file shows its Weaver view, and other Weaver documents offer a button to open their view, without affecting ordinary Markdown files.

## Acceptance criteria

- Opening a requirement file (`REQ-*.md`) shows the Requirement view, and the source stays one click away.
- A title-bar button opens the matching Weaver view from other Weaver documents, and does not appear on ordinary Markdown files.
- A task file opens the Requirement view of its requirement, focused on that task.
- The user can choose the text editor as the default again for requirement files.

## Tasks

- `TASK-017` Open requirement files in a Weaver editor — [GitHub Issue #40](https://github.com/blcktgr73/Weaver/issues/40)
- `TASK-018` Show the title-bar button only on Weaver documents — [GitHub Issue #41](https://github.com/blcktgr73/Weaver/issues/41)
- `TASK-019` Open the requirement view from a task file, focused on the task — [GitHub Issue #42](https://github.com/blcktgr73/Weaver/issues/42)

Decision and user-story maps have no view yet, so they get no button until a view exists.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
