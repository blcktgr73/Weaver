# Register your own Project

This guide points the Weaver Overview at **your** GitHub Project and repositories. It follows [DEC-007](../decisions/DEC-007-central-project-is-configuration.md): Weaver has no built-in Project, and the Project is whatever your `fabric.yaml` names. For the Overview itself, see section 7 of [Getting started](getting-started.md).

You need:

- VS Code 1.90 or later with the Weaver extension installed.
- A GitHub Project (the new Projects, not classic boards) that belongs to you or to an organization.
- The repositories whose work you want on the board, readable by your GitHub account.
- Git, if you want Weaver to clone the repositories for you.

## 1. Find the owner and the number of your Project

Open the Project in the browser. The address tells you both:

| Address | `owner` | `number` |
| --- | --- | --- |
| `https://github.com/users/your-login/projects/3` | `your-login` | `3` |
| `https://github.com/orgs/your-org/projects/7` | `your-org` | `7` |

An organization works the same way as a person. The registry only needs the login and the number.

## 2. Give your repositories the six status labels

Weaver places a card in a column from its Issue labels and state ([DEC-003](../decisions/DEC-003-board-status-mapping.md), [DEC-009](../decisions/DEC-009-keep-labels-for-columns.md)). It does not need a custom field on the Project; the default `Status` field is enough. Create the labels once in each repository:

```bash
for label in backlog ready in-progress blocked review verified; do
  gh label create "status:$label" --repo your-org/your-repo
done
```

An Issue with no `status:*` label is shown in Backlog and marked as having no status label.

## 3. Write `fabric.yaml`

Put this file at the root of the folder you open in VS Code ([schema](../product/artifact-schema-v0.1.md#fabric-registry)):

```yaml
project:
  owner: your-login-or-org
  number: 3
repositories:
  - your-org/your-repo
  - repository: your-org/another-repo
    title: Another repo      # optional label for the lane
```

The order of `repositories` is the order of the lanes. Weaver reports a mistake in this file (a missing field, a bad number, the same repository twice) in the Overview itself.

## 4. Put the Issues on the Project

The Overview shows only what is on the Project. A new Issue is not added to a Project by itself unless you set that up. Either add Issues with the command line:

```bash
gh project item-add 3 --owner your-login-or-org --url https://github.com/your-org/your-repo/issues/12
```

or use the Project's own workflow that adds Issues of a repository automatically (in the Project, open **Workflows**). The **Mismatches** list in the Overview tells you when a task file points at an Issue that is not on the Project.

## 5. Sign in with the right scopes

| Who reads | Login | Scopes |
| --- | --- | --- |
| The VS Code extension | VS Code's own GitHub sign-in. Press **Sign in to GitHub** in the Overview. | `repo` and `project` |
| The command line and agents | `gh auth login`, then `gh auth refresh -s project` | `repo` and `project` |

Checked against a personal Project: a login with `repo` and `project` reads every item. These were **not** tested, so do not rely on them yet:

- **Fine-grained personal access tokens.** A personal Project may not accept them.
- **Organization Projects.** The scopes may need an organization owner to approve the sign-in. If the Overview says the Project was not found or cannot be seen, check this first.

Without the `project` scope Weaver cannot read the Project and says so.

## 6. Clone the repositories and open them together

Run **Weaver: Set Fabric Root Folder**, then **Weaver: Clone Registered Repositories**, and open the root folder. The steps are in the [clone section of Getting started](getting-started.md#clone-the-registered-repositories). With the clones in one workspace, cards also link to their requirements and task files.

## When something is wrong

| What the Overview says | What it means and what to do |
| --- | --- |
| *Project N of OWNER was not found, or this sign-in cannot see it* | A wrong owner or number in `fabric.yaml`, or your sign-in cannot see that Project (see the organization note above). |
| *The GitHub sign-in lacks the "project" scope* | Press **Sign in to GitHub** again and accept the `project` scope. |
| *GitHub rejected the sign-in* | The sign-in expired. Sign in again. |
| *GitHub could not be reached* | Check the network and try **Refresh**. |
| *GitHub is limiting requests* | Wait a few minutes and press **Refresh**. |
| A lane with no cards | The repository has no Issues on the Project. See step 4. |
| *N Project items are not shown* | The Project also holds pull requests, drafts, or Issues of repositories that are not in `fabric.yaml`. This is normal. |
| *The registry has problems* | `fabric.yaml` is not valid. Each problem is listed with what to fix. |
