# DEC-016: An organization declares its task contract in the `task` section of `.weaver/process.yaml`

- Status: proposed on 2026-11-05, for the maintainer to accept
- Date: 2026-11-05
- Related: `REQ-010`, `TASK-065` to `TASK-068`, `US-043`, Issue #160, extends [DEC-015](./DEC-015-process-configuration.md), applies [DEC-007](./DEC-007-central-project-is-configuration.md), uses [DEC-005](./DEC-005-task-files.md) and [DEC-009](./DEC-009-keep-labels-for-columns.md)

## Context

PALab runs agents on a card contract (Owner, Type, Priority, Blocker, Human required, Related thread). `weaver task create` makes an Issue with only the `task` and `status:backlog` labels, so a PALab agent cannot pick the card up until a person fills the contract in. Other teams will have other fields.

[DEC-007](./DEC-007-central-project-is-configuration.md) already says that no Weaver feature may assume the PALab board. The same must hold for the fields of a task: the contract belongs to the organization, and Weaver only carries it out. [DEC-015](./DEC-015-process-configuration.md) gave a repository one file for its process, with every section optional and the repository as the single source of truth. The task contract fits there as one more section.

## Decision

1. **Independence principle.** Weaver core never depends on an organization's policy. Policy arrives as configuration, and PALab's contract is one example profile, not a default. This is written in `AGENTS.md`.
2. **Location and version.** The contract is the optional `task` section of `.weaver/process.yaml`, still `version: 1` because a missing section keeps today's behavior ([DEC-015](./DEC-015-process-configuration.md) item 3). It is read the same way as the other sections (item 9 there). It follows the rules of DEC-015 item 6: a section with an error is reported and ignored, the other sections still apply.
3. **Shape.**

   ```yaml
   task:
     require-file: true          # default true; false lets a card be an Issue only
     fields:
       owner:
         required: true          # default false
         values: [morpheus, tachikoma]   # optional list of allowed values
         source: file            # file (default) | project
         label: "owner:{value}"  # projection on the Issue; {value} is the field value
       priority:
         values: [P0, P1, P2]
         source: project
         project-field: Priority # projection on the Project item
       blocker:
         source: project
         project-field: Blocker
     body:
       sections: [Context, Done when]   # headings a task body must contain, in this order
   ```

4. **Field names.** A field name is lowercase letters, digits, and hyphens. In a task file it is a key of the front matter. It must not reuse a key that Weaver already owns (`id`, `type`, `title`, `requirement`, `issue`, `repository`, `assignee_type`, `assignee`, `criteria`, `status`, `reviewers`, `approvals`, and the other keys of [DEC-005](./DEC-005-task-files.md)). Such a name is an error of the section.
5. **Where a field lives (`source`).**
   - `file` (default): the task file is the source of truth, as for every other task fact ([AGENTS.md](../../AGENTS.md)). The Issue label or Project field named in the mapping is a projection that `task create` writes and `reconcile` compares. When they differ, the file wins and the difference is a gap.
   - `project`: the value lives only on the board, so a volatile field such as a blocker changes without a pull request. The task file does not carry it, and a value found in the file is a gap ("declared as project, found in file") so that no second copy grows. A `project` field must name a `project-field` or a `label`; without one there is nowhere for it to live, which is an error of the section.
6. **Mapping.** A field maps to at most one place: `label` (a template that contains `{value}`) or `project-field` (the name of a field of the Project). A field without a mapping lives only in the file and is never written to the board. The mapping is generic: Weaver does not know what a label or a field means to the organization.
7. **Light cards.** `require-file: false` lets a task be an Issue with no file. Such a card is not reported as "Issue without task file". A task that has a file is still checked against the fields. With `require-file: true` or no section, a missing file is reported as today.
8. **Body template.** `body.sections` lists the headings a task body should contain. `task create` writes them as empty headings; a missing heading is a gap, not an error.
9. **Violations are gaps, never errors.** The kinds, all listed by `reconcile` and shown on the card, are:
   - `task-field-missing`: a required field has no value;
   - `task-field-value`: a value is not in `values`;
   - `task-field-differs`: a file field differs from its projection on the board;
   - `task-field-in-file`: a `project` field is also written in the file;
   - `task-section-missing`: a heading of `body.sections` is absent.

   Only an invalid section (item 2) is an error, and it is reported at the file, not at the cards.
10. **`task create`.** It fills the declared fields from what the person gave (flags or prompts), shows the resulting labels, Project fields, and body in the plan for confirmation, as today, and writes only what the plan showed. A required field with no value stops the plan with a gap instead of creating a half-filled card. Without the section, `task create` is unchanged.
11. **No organization detail in Weaver.** Names such as Owner or Human required, and values such as `morpheus`, appear only in an organization's own file. This repository's examples and tests use neutral names.

## Examples

- **No section:** nothing changes. `task create` makes `task` and `status:backlog`.
- **A team with the PALab contract** would declare `owner`, `type`, `priority`, `blocker`, `human-required`, and `related-thread`, with the blocker on the board (`source: project`) and the others in the file with a label. That file lives in the PALab repository, not in Weaver (the worked example for `TASK-068` uses neutral names).

## Alternatives considered

- **Hard-code the PALab contract.** The shortest way, and the one [DEC-007](./DEC-007-central-project-is-configuration.md) rules out. A second organization would need a fork.
- **All fields on the board.** A change needs no pull request, but the facts of a task leave the repository ([AGENTS.md](../../AGENTS.md): do not hide important state in an external service). Hence `file` is the default and `project` is chosen per field.
- **All fields in the file.** A blocker that changes daily would need a pull request each time. Hence `source: project`.
- **A new file for the task contract.** Two files per repository would split the process. One file with one optional section keeps the adoption path of DEC-015.
- **Errors for violations.** A strict stop would block cards that colleagues create by hand. Gaps match how Weaver reports everything else.

## Consequences

- `TASK-066` reads the section and fills it in on `task create`; `TASK-067` adds the reconcile gaps and the light card; `TASK-068` adds the messages (English and Korean) and a worked example. No code reads the section until then.
- `parseProcess` gains a `task` section with its own validation, judged apart from the other sections.
- The file field keys extend the front matter of a task. A later task schema change must keep them out of Weaver's reserved keys.
- [DEC-015](./DEC-015-process-configuration.md) lists `task` among its sections, and the onboarding guide for the process file gets the section when `TASK-068` lands.

## Open points for the maintainer

1. **Owner and `assignee`.** A task file already has `assignee`. A team's `owner` field may mean the same. This record keeps them apart (item 4 forbids reusing `assignee`), so an organization that wants one must map `owner` to a label and leave `assignee` to Weaver. Say if `assignee` should be allowed as a declared field instead.
2. **Several mappings per field.** Item 6 allows one. A field that must be both a label and a Project field is not supported yet.
3. **Values from outside.** `values` is a literal list. Taking it from the shared roster belongs to `REQ-011`.

## Deferred

- Mapping one field to several places, and computed fields.
- Per-requirement or per-type contracts. One contract per repository for now.
