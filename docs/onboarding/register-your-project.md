# Register your own Project

This guide points the Weaver Overview at **your** GitHub Project. It follows [DEC-007](../decisions/DEC-007-central-project-is-configuration.md) and [DEC-014](../decisions/DEC-014-user-configuration.md): Weaver has no built-in Project, and the Project is whatever your own configuration names. That configuration is a file on your computer, `~/.weaver/config.yaml`; it belongs to you and is never committed to a repository. For the Overview itself, see section 7 of [Getting started](getting-started.md).

You need:

- VS Code 1.90 or later with the Weaver extension installed, or the `weaver` command line tool.
- A GitHub Project (the new Projects, not classic boards) that belongs to you or to an organization.
- The repositories whose work you want on the board, readable by your GitHub account.
- Git, if you want Weaver to clone the repositories for you.

## 1. Give your repositories the six status labels

Weaver places a card in a column from its Issue labels and state ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-009](../decisions/DEC-009-keep-labels-for-columns.md)). It does not need a custom field on the Project; the default `Status` field is enough. Create the labels once in each repository:

```bash
for label in backlog ready in-progress blocked review verified; do
  gh label create "status:$label" --repo your-org/your-repo
done
```

An Issue with no `status:*` label is shown in Backlog and marked as having no status label.

A repository that already tracks its work on the board and does not want labels can let the board decide instead. That is a setting of the repository, not of you: see [Configure how your repository tracks its work](configure-your-process.md).

## 2. Run the setup

**In VS Code:** run **Weaver: Set Up** from the command palette (or press **Set up** in the empty Overview).

**In a terminal:** run `weaver init`.

Both ask the same things, in this order, and show you the file before they write it:

1. **Which Project.** They list the Projects you can see, yours and your organizations'. Pick one, or give an address such as `https://github.com/users/your-login/projects/3` (`orgs` for an organization) or `owner/3`.
2. **Which repositories to leave out.** Weaver reads the Project and lists the repositories that have cards on it. Everything ticked is shown. Untick the ones you do not want; if you leave all ticked, the Overview follows the Project, so a repository added to it later appears by itself.
3. **Who is on your roster** (optional): people found on the cards, and agents you work with, such as `claude-code`.
4. **The file.** You see its text and its path, and it is written only after you say yes. A file that was there is kept next to it as `config.yaml.bak`. Running the setup again starts from what is there.

The file is `~/.weaver/config.yaml` (under `WEAVER_HOME` if you set it). [`config.example.yaml`](../../config.example.yaml) shows every field. You can also write it by hand:

```yaml
project:
  owner: your-login-or-org
  number: 3
```

The editor and the `weaver` tool read the same file. It is never inside a repository.

### Sharing a Project with a team

If a team wants everyone to open the same Project and repositories, a workspace can hold a `fabric.yaml` at its root ([schema](../product/artifact-schema-v0.1.md#fabric-registry)). In a workspace that has one, the Overview opens by itself and uses it for the Project and the repositories; your roster still comes from your own file. It is optional, and nothing needs it.

```yaml
project:
  owner: your-login-or-org
  number: 3
repositories:
  - your-org/your-repo
  - repository: your-org/another-repo
    title: Another repo      # optional label for the lane
```

The order of `repositories` is the order of the lanes. Weaver reports a mistake in this file (a missing field, a bad number, the same repository twice) in the Overview itself. [`examples/overview/fabric.yaml`](../../examples/overview/fabric.yaml) is a working example; `npm run dev:overview` opens it.

### Moving from a `fabric.yaml` you already have

An earlier version of this repository kept a `fabric.yaml` at its root for the maintainer's own Project. A `fabric.yaml` that describes only *you* does not belong in a repository, because it differs from person to person. To move from it:

1. Run the setup (step 2) and pick the same Project. To keep a repository list, leave the others unticked; otherwise leave all ticked.
2. Check the Overview shows what you expect. A `fabric.yaml` in the workspace still wins over your file, so remove it from the folder you open, or leave it if the team shares it on purpose.
3. If you had a `roster.yaml`, its people and agents go into the roster step of the setup.
4. Delete the old file from your clone once the Overview works without it.

## 3. Put the Issues on the Project

The Overview shows only what is on the Project. A new Issue is not added to a Project by itself unless you set that up. Either add Issues with the command line:

```bash
gh project item-add 3 --owner your-login-or-org --url https://github.com/your-org/your-repo/issues/12
```

or use the Project's own workflow that adds Issues of a repository automatically (in the Project, open **Workflows**). The **Mismatches** list in the Overview tells you when a task file points at an Issue that is not on the Project.

## 4. Sign in with the right scopes

| Who reads | Login | Scopes |
| --- | --- | --- |
| The VS Code extension | VS Code's own GitHub sign-in. The setup asks for it, or press **Sign in to GitHub** in the Overview. | `repo` and `project` |
| The command line and agents | `gh auth login`, then `gh auth refresh -s project` | `repo` and `project` |

Checked against a personal Project: a login with `repo` and `project` reads every item. These were **not** tested, so do not rely on them yet:

- **Fine-grained personal access tokens.** A personal Project may not accept them.
- **Organization Projects.** The scopes may need an organization owner to approve the sign-in. If the Overview says the Project was not found or cannot be seen, check this first.

Without the `project` scope Weaver cannot read the Project and says so.

## 5. Clone the repositories and open them together

Run **Weaver: Set Fabric Root Folder**, then **Weaver: Clone Registered Repositories**, and open the root folder. The steps are in the [clone section of Getting started](getting-started.md#clone-the-registered-repositories). With the clones in one workspace, cards also link to their requirements and task files. Without a repository list in your configuration, the clone command offers every repository the Project has cards of.

## When something is wrong

| What the Overview says | What it means and what to do |
| --- | --- |
| *Weaver is not set up on this computer yet* | There is no configuration yet. Run **Weaver: Set Up**. |
| *Project N of OWNER was not found, or this sign-in cannot see it* | A wrong owner or number in your configuration, or your sign-in cannot see that Project (see the organization note above). Run the setup again to pick from the list. |
| *The GitHub sign-in lacks the "project" scope* | Press **Sign in to GitHub** again and accept the `project` scope. |
| *GitHub rejected the sign-in* | The sign-in expired. Sign in again. |
| *GitHub could not be reached* | Check the network and try **Refresh**. |
| *GitHub is limiting requests* | Wait a few minutes and press **Refresh**. |
| A lane with no cards | The repository has no Issues on the Project. See step 3. |
| *N Project items are not shown* | The Project also holds pull requests or drafts, or Issues of repositories you left out. This is normal. |
| *The registry has problems* | Your configuration (or the workspace `fabric.yaml`) is not valid. Each problem is listed with what to fix. |
