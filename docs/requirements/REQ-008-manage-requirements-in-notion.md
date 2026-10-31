---
id: REQ-008
type: requirement
title: Teams can draft and follow requirements in Notion while the repository stays authoritative
status: draft
owner: PALab
story_ids: [US-032, US-033, US-034]
repository: blcktgr73/Weaver
github_project: PALab Ops Kanban
---

# Teams can draft and follow requirements in Notion while the repository stays authoritative

## Problem

Product people and stakeholders often draft and discuss requirements in Notion, while Weaver keeps requirement intent in repository Markdown. Today the two are joined only by copy and paste, so a Notion page and its `REQ-###` file drift apart, and nobody can tell which one is current. The story map lists "Import or link requirements from Notion" but no requirement covers it.

## Outcome

A team can write and discuss a requirement in Notion, bring it into the repository through a reviewed change, and see the requirement's tasks and status in Notion afterwards. The repository remains the source of truth. Notion is a collaboration surface and a projection, as the [source-of-truth policy](../../AGENTS.md) requires.

## Authority boundaries

```text
Notion page            → draft text, discussion, comments (before import)
Requirement Markdown   → intent, constraints, acceptance criteria (after import)
GitHub Issue           → task execution state
Notion projection      → read-only copy of status, task list, and evidence links
```

After a requirement is imported, edits to its intent and acceptance criteria are made in the repository. The Notion page shows them but does not change them silently.

## Acceptance criteria

- A requirement file can record the Notion page it came from or is linked to, in its front matter, and Weaver shows that link in the Requirement view.
- A user can import a Notion page into a new `REQ-###` Markdown file with a stable ID and the standard sections. The import is a normal repository change that goes through review, never a direct write to the default branch.
- Importing the same page again shows a diff against the repository file and does not overwrite it without confirmation.
- Weaver can write a requirement's current status, task list, and evidence links back to the linked Notion page. Those fields are marked read-only and are rebuilt from the repository, so a hand edit in Notion does not change repository state.
- The Notion access token is stored in the editor's secret storage and never in the repository, a task file, or a log.
- Weaver works fully without Notion. Nothing in the Requirement, Kanban, or verification views depends on a Notion connection.
- Every user-facing message for this feature is in the message catalog in English and Korean.

## Open decisions

- Direction of sync: one-way import plus a one-way status projection (assumed above), or two-way text sync. Two-way sync is not planned until the first direction is proven.
- Mapping of Notion blocks to Markdown: which block types are supported at first, and what happens to the rest.
- Whether Notion comments are brought into the repository, and how.
- Whether the connection uses a Notion integration token or an OAuth flow.

These are recorded as `DEC-###` documents before the related tasks start.

## Tasks

Tasks are not created yet. They are split from the acceptance criteria once the open decisions above are settled.

## Evidence policy

This requirement is not complete when a task is merely reported as done. Completion requires repository changes, checks, and an explicit review of remaining gaps.
