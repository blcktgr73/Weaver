import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { FabricProject, FabricRegistry, FabricRepository, readFabricProject, readFabricRepositories } from './fabric';
import type { MessageArgs } from './i18n';
import { readRoster, Roster } from './roster';
import type { ValidationIssue } from './types';

/** A person's own configuration, `~/.weaver/config.yaml` (DEC-014). It is never committed. */
export interface UserConfig {
  project: FabricProject;
  /** Left out: every repository that has cards on the Project is shown. */
  repositories?: FabricRepository[];
  roster?: Roster;
}

export interface ConfigParseResult {
  /** Present only when the file has no errors. Warnings do not hide it. */
  config?: UserConfig;
  issues: ValidationIssue[];
}

const KNOWN_FIELDS = ['project', 'repositories', 'roster'];

const isMapping = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads the personal configuration. `project` is required; `repositories` and `roster` are optional.
 * A `repositories` list that is given must not be empty, because an empty list would show nothing.
 */
export function parseConfig(path: string, text: string): ConfigParseResult {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], code: string, args?: MessageArgs) =>
    issues.push({ severity, code, ...(args ? { args } : {}), path });

  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    add('error', 'config-invalid-yaml', { detail: (error as Error).message });
    return { issues };
  }
  if (!isMapping(data)) {
    add('error', 'config-not-a-mapping');
    return { issues };
  }
  for (const field of Object.keys(data)) if (!KNOWN_FIELDS.includes(field)) add('warning', 'unknown-field', { field });

  const project = readFabricProject(data.project, add);
  const repositories = data.repositories === undefined || data.repositories === null ? undefined : readFabricRepositories(data.repositories, add);
  const roster = data.roster === undefined || data.roster === null ? undefined : readRoster(data.roster, add);

  if (issues.some((issue) => issue.severity === 'error') || !project) return { issues };
  return { config: { project, ...(repositories ? { repositories } : {}), ...(roster ? { roster } : {}) }, issues };
}

/** Where the Project and the repositories came from. */
export type SetupSource = 'workspace' | 'user';

/** What the Overview and the tool work from, after the workspace file and the personal file are weighed. */
export interface Setup {
  source: SetupSource;
  project: FabricProject;
  /** Absent: show every repository that has cards on the Project. */
  repositories?: FabricRepository[];
  roster?: Roster;
}

/**
 * The workspace `fabric.yaml`, when there is one, decides the Project and the repositories for that
 * workspace; otherwise the personal file does. The roster always comes from the personal file,
 * because who a person works with is not something a shared file should say (DEC-014).
 */
export function resolveSetup(workspace: FabricRegistry | undefined, user: UserConfig | undefined): Setup | undefined {
  if (workspace) return { source: 'workspace', project: workspace.project, repositories: workspace.repositories, ...(user?.roster ? { roster: user.roster } : {}) };
  if (user) return { source: 'user', project: user.project, ...(user.repositories ? { repositories: user.repositories } : {}), ...(user.roster ? { roster: user.roster } : {}) };
  return undefined;
}

/**
 * The repositories to show: the given list, in its order, or else every repository that has cards
 * on the Project, in alphabetical order without regard to case. A repository is named as the
 * Project spells it.
 */
export function effectiveRepositories(setup: Pick<Setup, 'repositories'>, cardRepositories: Iterable<string>): FabricRepository[] {
  if (setup.repositories) return setup.repositories;
  const seen = new Map<string, string>();
  for (const name of cardRepositories) if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  return [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map((repository) => ({ repository }));
}

const CONFIG_HEADER = `# Weaver personal configuration (DEC-014). It belongs to you and is not committed anywhere.
# Written by the Weaver setup; you can edit it by hand. Comments you add are lost when the setup writes it again.
`;

/**
 * The text of a personal configuration. A repository without a title is written as `owner/name`;
 * the roster and the repository list are left out when they are empty.
 */
export function serializeConfig(config: UserConfig): string {
  const data: Record<string, unknown> = { project: { owner: config.project.owner, number: config.project.number } };
  if (config.repositories?.length) data.repositories = config.repositories.map((r) => (r.title ? { repository: r.repository, title: r.title } : r.repository));
  if (config.roster?.contributors.length) data.roster = { contributors: config.roster.contributors.map((c) => ({ ...c })) };
  return `${CONFIG_HEADER}${stringifyYaml(data)}`;
}
