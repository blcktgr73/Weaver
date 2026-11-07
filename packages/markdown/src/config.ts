import { parse as parseYaml, parseDocument, stringify as stringifyYaml } from 'yaml';
import { FabricProject, FabricRegistry, FabricRepository, readFabricProject, readFabricRepositories } from './fabric';
import type { MessageArgs } from './i18n';
import { readRoster, Roster, RosterLayerName, stackRosters } from './roster';
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

/** A Project named by its address (`.../users/you/projects/3`, `.../orgs/team/projects/7`) or as `owner/3`. */
export function parseProjectRef(text: string): { owner: string; number: number } | undefined {
  const wanted = text.trim().replace(/\/+$/, '');
  const address = /^https:\/\/github\.com\/(?:users|orgs)\/([^/\s]+)\/projects\/(\d+)(?:\/.*)?$/i.exec(wanted);
  if (address) return { owner: address[1], number: Number(address[2]) };
  const short = /^([A-Za-z0-9][A-Za-z0-9-]*)\/(\d+)$/.exec(wanted);
  return short ? { owner: short[1], number: Number(short[2]) } : undefined;
}

/** Where the Project and the repositories came from: the workspace `fabric.yaml`, a root file, or the personal file. */
export type SetupSource = 'workspace' | 'root' | 'user';

/** A root file that was found (DEC-018): what it says, and where it is. */
export interface RootConfig {
  config: UserConfig;
  path: string;
}

/** What the Overview and the tool work from, after the workspace file, a root file, and the personal file are weighed. */
export interface Setup {
  source: SetupSource;
  project: FabricProject;
  /** Absent: show every repository that has cards on the Project. */
  repositories?: FabricRepository[];
  roster?: Roster;
  /** The root file that decided, when `source` is `root`. */
  rootFile?: string;
  /** The path of the file that decided `project` and `repositories`, when the caller knew it (DEC-018 item 9). */
  decidedBy?: string;
  /** The files that gave the roster, lowest layer first (DEC-018 item 9). */
  rosterFiles: { layer: 'root' | 'personal'; file?: string }[];
  /** For each contributor id (lower case), the layers it comes from, lowest first (DEC-018 items 6 and 9). */
  rosterOrigins: Map<string, RosterLayerName[]>;
}

/** The paths of the files that were read, for naming the one that decided (DEC-018 item 9). */
export interface SetupFiles {
  workspace?: string;
  user?: string;
}

/**
 * The roster of the files: the root file's contributors laid under the personal file's, so an id in both
 * takes the personal fields (DEC-018 item 6). The reference (`roster.from`) is the first one declared,
 * the root file's before the personal file's (item 5). With no root roster, the personal one is kept as it is.
 */
function stackRoster(root: Roster | undefined, personal: Roster | undefined): { roster?: Roster; origins: Map<string, RosterLayerName[]> } {
  const stacked = stackRosters([
    { name: 'root', roster: root },
    { name: 'personal', roster: personal },
  ]);
  if (!stacked) return { origins: new Map() };
  const from = root?.from ?? personal?.from;
  const roster = root ? { contributors: stacked.roster.contributors, ...(from ? { from } : {}) } : stacked.roster;
  return { roster, origins: stacked.origins };
}

/**
 * The workspace `fabric.yaml`, when there is one, decides the Project and the repositories for that
 * workspace; otherwise the nearest root file does, and otherwise the personal file (DEC-014 item 4,
 * amended by DEC-018 item 4). The winning file decides both as a whole: a file with no
 * `repositories` shows every repository of its Project and does not borrow another file's list.
 * The roster is the root file's laid under the personal file's (DEC-018 item 6); a workspace
 * file never says who a person works with (DEC-014). `files` names the paths that were read, so the
 * result can say which file decided and which files gave the roster.
 */
export function resolveSetup(workspace: FabricRegistry | undefined, user: UserConfig | undefined, root?: RootConfig, files: SetupFiles = {}): Setup | undefined {
  const { roster, origins } = stackRoster(root?.config.roster, user?.roster);
  const rosterFiles: Setup['rosterFiles'] = [
    ...(root?.config.roster ? [{ layer: 'root' as const, file: root.path }] : []),
    ...(user?.roster ? [{ layer: 'personal' as const, ...(files.user ? { file: files.user } : {}) }] : []),
  ];
  const common = { ...(roster ? { roster } : {}), rosterFiles, rosterOrigins: origins };
  if (workspace) return { source: 'workspace', project: workspace.project, repositories: workspace.repositories, ...(files.workspace ? { decidedBy: files.workspace } : {}), ...common };
  if (root) {
    const { project, repositories } = root.config;
    return { source: 'root', project, ...(repositories ? { repositories } : {}), rootFile: root.path, decidedBy: root.path, ...common };
  }
  if (user) {
    return { source: 'user', project: user.project, ...(user.repositories ? { repositories: user.repositories } : {}), ...(files.user ? { decidedBy: files.user } : {}), ...common };
  }
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
  if (config.roster?.contributors.length || config.roster?.from) {
    data.roster = {
      ...(config.roster.from ? { from: { ...config.roster.from } } : {}),
      ...(config.roster.contributors.length ? { contributors: config.roster.contributors.map((c) => ({ ...c })) } : {}),
    };
  }
  return `${CONFIG_HEADER}${stringifyYaml(data)}`;
}

/**
 * The configuration text with a new `repositories` list and nothing else changed: comments, the
 * roster, and the order of the other fields stay. `undefined` removes the list, so every repository
 * of the Project is shown. A repository that was listed with a title keeps its title.
 */
export function setRepositories(text: string, repositories: readonly string[] | undefined): string {
  const document = parseDocument(text);
  if (repositories === undefined) {
    document.delete('repositories');
    return String(document);
  }
  const titled = new Map(readFabricRepositories(document.toJS()?.repositories, () => undefined).filter((r) => r.title).map((r) => [r.repository.toLowerCase(), r.title as string]));
  document.set(
    'repositories',
    document.createNode(repositories.map((repository) => (titled.has(repository.toLowerCase()) ? { repository, title: titled.get(repository.toLowerCase()) } : repository))),
  );
  return String(document);
}
