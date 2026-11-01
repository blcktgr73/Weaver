# First round of using Weaver for real

Weaver is developed with its own workflow ([AGENTS.md](../../AGENTS.md)). This page prepares the first round in which people other than its maintainer use it. It has two parts: a checklist for the colleague taking part, and the way a report becomes work for the maintainer.

## For the colleague taking part

You did not build Weaver and you work in a shared GitHub Project. You need VS Code 1.90 or later, and a GitHub account that can read that Project and its repositories. You do not need a configuration file from anyone: the setup writes your own.

**This is the first time someone else uses it.** Two things were never tried with another person's account: a Project that belongs to an organization (its owner may have to approve the sign-in), and your own roster of people. If one of them fails, that is exactly the feedback this round is for.

### Checklist

Tick each line as you go. If a line does not work, stop there and report it (see the end of this page); you do not have to finish the list.

**1. Install**

- [ ] Download `weaver-<version>.vsix` from the [latest Release](https://github.com/blcktgr73/Weaver/releases).
- [ ] In VS Code: Extensions view, `…`, **Install from VSIX…**, and pick the file. (Or `code --install-extension <path to the file>`.)
- [ ] The extension `palab.weaver` is listed, and a **Weaver** item is in the status bar.

**2. Set up**

- [ ] Run **Weaver: Set Up** from the command palette.
- [ ] Sign in to GitHub when VS Code asks. Weaver needs to read your repositories and Projects.
- [ ] Pick your team's Project from the list (or give its address, for example `https://github.com/orgs/your-team/projects/3`).
- [ ] Leave all repositories ticked, or untick the ones you do not want to see.
- [ ] Read the file it shows, and press **Write**. It is written to `~/.weaver/config.yaml` on your computer only, and nothing is committed anywhere.

**3. See the Overview**

- [ ] Press **Weaver** in the status bar. The Overview opens with a lane for each repository of the Project.
- [ ] The cards are in columns that make sense for how your team works. If most cards sit in Backlog or Review with a note such as "no status label", write down which.
- [ ] Press **Refresh**, then close and reopen the Overview.

**4. Open a requirement view**

- [ ] Press a card title that has a requirement tag, or run **Weaver: Open Requirement View** in a repository that has requirement files.
- [ ] The view lists the requirement, its tasks, and who owns them. Press **Load issue status**.
- [ ] You can tell from the page what is verified and what is not.

If your repositories have no requirement files yet, step 4 will say so; that is a finding too, not a mistake of yours.

### What Weaver will not do

It does not change your cards unless you press a button that says what it will change and confirm it. Reading the board changes nothing.

### Report friction

Open [a feedback report](https://github.com/blcktgr73/Weaver/issues/new?template=dogfooding-feedback.yml). It asks four things: what you were trying to do, what you expected, what happened, and how much it got in the way. A screenshot helps. Short is fine.

## For the maintainer: from a report to a story and a task

Friction is a product requirement, not a private workaround ([AGENTS.md](../../AGENTS.md)). Handle each report in this order:

1. **Read it and reproduce or ask.** Add a comment with what you found. If it is only a question, answer it and close it.
2. **Write a story.** Add a `US-###` line to the [user story map](../product/user-story-map.md) in the form "As a ..., I ..., so that ...", with a short note of the friction and the date, and the requirement it belongs to. Link the report from the line. Use the next free number.
3. **Decide where it belongs.** If a requirement already covers it, add an acceptance criterion there. If none does, write a new `REQ-###` in English, with its criteria.
4. **Make a task only when work is needed.** Create the task file and its Issue (`weaver task create --requirement REQ-### --title "..."`, which shows the plan and asks before it writes). A report that needs only a decision gets a `DEC-###` instead.
5. **Close the loop.** Comment on the report with the story and task numbers, and close it when the task is verified. Tell the colleague what changed.

Keep a report open until it has a story. Do not fix friction without writing it down: the user story map is how the next round learns what the last one found.
