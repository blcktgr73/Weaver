---
id: TASK-063
type: task
title: Reach the Overview and its settings from the Activity Bar and the Overview tab
requirement: REQ-006
issue: https://github.com/blcktgr73/Weaver/issues/152
repository: blcktgr73/Weaver
assignee_type: agent
criteria: [AC-015]
assignee: claude-code
---

# TASK-063 Reach the Overview and its settings from the Activity Bar and the Overview tab

Tracked in [Issue #152](https://github.com/blcktgr73/Weaver/issues/152). Ownership is recorded here; the Kanban column comes from the Issue ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-005](../decisions/DEC-005-task-files.md)).

Every command of Weaver is reached through the command palette, which is hard to find. The Overview gets an entry in the Activity Bar and a menu on its tab, and a person can choose which repositories to show without editing `~/.weaver/config.yaml` by hand.

## Done when

- An Activity Bar icon opens a Weaver view that lists the actions: open the Overview, choose repositories, open the configuration file, set up, set the clone folder, clone missing repositories.
- The tab of the Overview has a refresh icon and a menu with the same actions.
- "Choose repositories" lists the repositories of the Project, ticks the ones shown, shows what will change, and after a yes writes only the `repositories` list of the personal configuration, keeping its comments and the old file as `config.yaml.bak`. With a workspace `fabric.yaml` in use, it says that the list comes from that file.
- The status bar entry is removed.
- The behavior is checked by hand in the development host.

## Progress

- Built: a Weaver icon in the Activity Bar with a view that lists the six actions; on the tab of the Overview, a refresh icon and a menu (`…`) with choose repositories, open the configuration file, set up, set the clone folder, and clone; the status bar entry is removed. "Choose the repositories to show" reads the Project, ticks the repositories now shown, shows the change, and after a yes writes only the `repositories` list (`setRepositories` in the shared package, with tests that comments and the roster stay), keeping the old file as `config.yaml.bak`; ticking everything removes the list, as the setup does. With a workspace `fabric.yaml` in use it says so instead. The extension is version 0.2.0 and `dist/weaver-0.2.0.vsix` was built.
- Not yet done: the last "Done when" item. `npm run check` and the tests pass and the VSIX packages, but the icon, the view, the tab menu, and the picker were not driven in a development host.