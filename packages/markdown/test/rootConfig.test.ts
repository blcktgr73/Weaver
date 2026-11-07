import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRootConfig, formatNotice, parseConfig, parseFabric, parseRoster, parseRootConfig, resolveSetup, rootConfigCandidates, stackRosters, type Roster, type RootConfig, type UserConfig } from '../src';

const PROJECT = 'project: {owner: team, number: 9}\n';
const user = (text: string): UserConfig => {
  const config = parseConfig('config.yaml', text).config;
  if (!config) throw new Error('bad config');
  return config;
};
const root = (text: string, file = '/projects/.weaver/config.yaml'): RootConfig => {
  const config = parseRootConfig(file, text).config;
  if (!config) throw new Error('bad root config');
  return { config, path: file };
};

describe('rootConfigCandidates', () => {
  const personal = path.resolve('/home/me/.weaver/config.yaml');

  it('lists the start folder and each parent up to the top, nearest first', () => {
    const files = rootConfigCandidates(path.resolve('/projects/org/app'), personal);
    expect(files[0]).toBe(path.join(path.resolve('/projects/org/app'), '.weaver', 'config.yaml'));
    expect(files[1]).toBe(path.join(path.resolve('/projects/org'), '.weaver', 'config.yaml'));
    expect(files[2]).toBe(path.join(path.resolve('/projects'), '.weaver', 'config.yaml'));
    expect(files.at(-1)).toBe(path.join(path.parse(path.resolve('/projects')).root, '.weaver', 'config.yaml'));
  });

  it('leaves out the personal file, because it is the last layer already', () => {
    const files = rootConfigCandidates(path.resolve('/home/me/projects/app'), personal);
    expect(files).not.toContain(personal);
    expect(files).toContain(path.join(path.resolve('/home/me/projects'), '.weaver', 'config.yaml'));
  });

  it('leaves the personal file out wherever WEAVER_HOME puts it, and without regard to case on Windows', () => {
    const moved = path.resolve('/projects/org/.weaver/config.yaml');
    expect(rootConfigCandidates(path.resolve('/projects/org/app'), moved)).not.toContain(moved);
    if (process.platform === 'win32') {
      expect(rootConfigCandidates(path.resolve('/projects/org/app'), moved.toUpperCase())).not.toContain(moved);
    }
  });
});

describe('parseRootConfig', () => {
  it('reads the keys of the personal file', () => {
    const result = parseRootConfig('r.yaml', `${PROJECT}repositories:\n  - team/app\nroster:\n  contributors:\n    - {id: maria, kind: human}\n`);
    expect(result.issues).toEqual([]);
    expect(result.config?.project).toEqual({ owner: 'team', number: 9 });
    expect(result.config?.repositories).toEqual([{ repository: 'team/app' }]);
    expect(result.config?.roster?.contributors[0].id).toBe('maria');
  });

  it('reports each process section with its own warning, and still reads the file', () => {
    const result = parseRootConfig('r.yaml', `version: 1\n${PROJECT}columns:\n  source: labels\nevidence: {}\nstale: {}\ntask: {}\n`);
    expect(result.config).toBeDefined();
    expect(result.issues.map((i) => `${i.severity}:${i.code}:${i.args?.field}`)).toEqual([
      'warning:root-process-section:version',
      'warning:root-process-section:columns',
      'warning:root-process-section:evidence',
      'warning:root-process-section:stale',
      'warning:root-process-section:task',
    ]);
  });

  it('keeps the general warning for a field that is not a process section', () => {
    expect(parseRootConfig('r.yaml', `${PROJECT}colour: blue\n`).issues.map((i) => i.code)).toEqual(['unknown-field']);
  });

  it('says in both languages where the process belongs', () => {
    const issue = parseRootConfig('r.yaml', `${PROJECT}columns: {}\n`).issues[0];
    const notice = { code: `validation.${issue.code}` as never, args: issue.args };
    expect(formatNotice(notice, 'en')).toContain('.weaver/process.yaml');
    expect(formatNotice(notice, 'ko')).toContain('.weaver/process.yaml');
  });

  it('does not hide a missing Project', () => {
    expect(parseRootConfig('r.yaml', 'repositories: [team/app]\n').config).toBeUndefined();
  });
});

describe('resolveSetup with a root file', () => {
  const personal = user('project: {owner: me, number: 1}\nrepositories: [me/mine]\nroster:\n  contributors:\n    - {id: maria, kind: human, name: Maria}\n');
  const shared = parseFabric('fabric.yaml', 'project: {owner: shared, number: 5}\nrepositories:\n  - shared/app\n').registry;

  it('lets a root file decide the Project and the repositories over the personal file, and names the file', () => {
    const setup = resolveSetup(undefined, personal, root(`${PROJECT}repositories:\n  - team/app\n`));
    expect(setup).toMatchObject({ source: 'root', project: { owner: 'team', number: 9 }, repositories: [{ repository: 'team/app' }], rootFile: '/projects/.weaver/config.yaml' });
  });

  it('lets the workspace fabric.yaml win over a root file', () => {
    const setup = resolveSetup(shared, personal, root(PROJECT));
    expect(setup?.source).toBe('workspace');
    expect(setup?.project.owner).toBe('shared');
    expect(setup?.rootFile).toBeUndefined();
  });

  it('does not borrow the personal repository list when the root file gives none', () => {
    const setup = resolveSetup(undefined, personal, root(PROJECT));
    expect(setup?.source).toBe('root');
    expect(setup?.repositories).toBeUndefined();
  });

  it('works from a root file alone', () => {
    expect(resolveSetup(undefined, undefined, root(PROJECT))).toMatchObject({ source: 'root', project: { owner: 'team' } });
  });

  it('lays the root roster under the personal one: an id in both takes the personal fields, none is removed', () => {
    const setup = resolveSetup(
      undefined,
      personal,
      root(`${PROJECT}roster:\n  contributors:\n    - {id: Maria, kind: human, github: maria-gh, name: Org Maria}\n    - {id: bot, kind: agent, tool: Claude, model: opus, reach: me}\n`),
    );
    const byId = Object.fromEntries((setup?.roster?.contributors ?? []).map((c) => [c.id.toLowerCase(), c]));
    expect(Object.keys(byId).sort()).toEqual(['bot', 'maria']);
    expect(byId.maria).toMatchObject({ id: 'Maria', name: 'Maria', github: 'maria-gh' });
  });

  it('takes the roster reference of the root file before the personal one', () => {
    const withFrom = (repo: string) => `roster:\n  from: {repository: ${repo}, path: roster.yaml}\n`;
    const setup = resolveSetup(undefined, user(`project: {owner: me, number: 1}\n${withFrom('me/people')}`), root(`${PROJECT}${withFrom('team/people')}`));
    expect(setup?.roster?.from?.repository).toBe('team/people');
    expect(resolveSetup(undefined, user(`project: {owner: me, number: 1}\n${withFrom('me/people')}`), root(PROJECT))?.roster?.from?.repository).toBe('me/people');
  });

  it('keeps the personal roster exactly as before when there is no root file', () => {
    expect(resolveSetup(undefined, personal)?.roster).toBe(personal.roster);
  });
});

describe('stackRosters', () => {
  const roster = (text: string): Roster => {
    const parsed = parseRoster('r.yaml', text).roster;
    if (!parsed) throw new Error('bad roster');
    return parsed;
  };
  const shared = roster('contributors:\n  - {id: maria, kind: human, name: Org Maria}\n  - {id: bot, kind: agent, tool: Claude, model: opus, reach: [{type: label, value: "owner:bot"}]}\n');
  const rootLayer = roster('contributors:\n  - {id: Maria, kind: human, github: maria-gh}\n  - {id: lee, kind: human}\n');
  const personal = roster('contributors:\n  - {id: bot, kind: agent, tool: Claude, model: sonnet}\n  - {id: MARIA, kind: human, name: Maria}\n');

  it('lays each layer over the one below, and says which layers gave each contributor', () => {
    const stacked = stackRosters([
      { name: 'shared', roster: shared },
      { name: 'root', roster: rootLayer },
      { name: 'personal', roster: personal },
    ]);
    const byId = Object.fromEntries((stacked?.roster.contributors ?? []).map((c) => [c.id.toLowerCase(), c]));
    expect(Object.keys(byId).sort()).toEqual(['bot', 'lee', 'maria']);
    expect(byId.maria).toMatchObject({ id: 'maria', name: 'Maria', github: 'maria-gh' });
    expect(byId.bot).toMatchObject({ model: 'sonnet', tool: 'Claude' });
    expect(stacked?.origins.get('maria')).toEqual(['shared', 'root', 'personal']);
    expect(stacked?.origins.get('bot')).toEqual(['shared', 'personal']);
    expect(stacked?.origins.get('lee')).toEqual(['root']);
  });

  it('never removes a contributor of a lower layer, and replaces roles and reach as a whole', () => {
    const lower = roster('contributors:\n  - {id: bot, kind: agent, tool: A, model: m, roles: [build, review], reach: [{type: label, value: "owner:bot"}]}\n');
    const higher = roster('contributors:\n  - {id: bot, kind: agent, tool: A, model: m, roles: [review]}\n');
    const stacked = stackRosters([{ name: 'shared', roster: lower }, { name: 'personal', roster: higher }]);
    expect(stacked?.roster.contributors).toHaveLength(1);
    expect(stacked?.roster.contributors[0].roles).toEqual(['review']);
    expect(stacked?.roster.contributors[0].reach).toBeDefined();
  });

  it('skips a layer that is left out, returns one layer as it is, and nothing for none', () => {
    expect(stackRosters([{ name: 'root', roster: undefined }, { name: 'personal', roster: personal }])?.roster).toBe(personal);
    expect(stackRosters([{ name: 'root', roster: undefined }])).toBeUndefined();
  });
});

describe('resolveSetup names the files', () => {
  const personal = user('project: {owner: me, number: 1}\nroster:\n  contributors:\n    - {id: maria, kind: human, name: Maria}\n');

  it('names the personal file as the one that decided, and the layers of each contributor', () => {
    const setup = resolveSetup(undefined, personal, undefined, { user: '/home/me/.weaver/config.yaml' });
    expect(setup?.decidedBy).toBe('/home/me/.weaver/config.yaml');
    expect(setup?.rosterFiles).toEqual([{ layer: 'personal', file: '/home/me/.weaver/config.yaml' }]);
    expect(setup?.rosterOrigins.get('maria')).toEqual(['personal']);
  });

  it('names the root file that decided, and both files that gave the roster', () => {
    const setup = resolveSetup(
      undefined,
      personal,
      root(`${PROJECT}roster:\n  contributors:\n    - {id: maria, kind: human, github: maria-gh}\n`),
      { user: '/home/me/.weaver/config.yaml' },
    );
    expect(setup?.decidedBy).toBe('/projects/.weaver/config.yaml');
    expect(setup?.rosterFiles).toEqual([
      { layer: 'root', file: '/projects/.weaver/config.yaml' },
      { layer: 'personal', file: '/home/me/.weaver/config.yaml' },
    ]);
    expect(setup?.rosterOrigins.get('maria')).toEqual(['root', 'personal']);
  });

  it('names the workspace file when it decides, and says nothing when no path was given', () => {
    const shared = parseFabric('fabric.yaml', 'project: {owner: shared, number: 5}\nrepositories:\n  - shared/app\n').registry;
    expect(resolveSetup(shared, personal, undefined, { workspace: '/work/fabric.yaml' })?.decidedBy).toBe('/work/fabric.yaml');
    expect(resolveSetup(shared, personal)?.decidedBy).toBeUndefined();
  });
});

describe('findRootConfig', () => {
  const start = path.resolve('/projects/org/app');
  const personal = path.resolve('/home/me/.weaver/config.yaml');
  const at = (folder: string) => path.join(path.resolve(folder), '.weaver', 'config.yaml');
  const reader = (files: Record<string, string>) => async (file: string) => files[file];

  it('returns the nearest file that has text, and reads it', async () => {
    const found = await findRootConfig(start, personal, reader({ [at('/projects')]: PROJECT, [at('/projects/org')]: 'project: {owner: near, number: 2}\n' }));
    expect(found).toMatchObject({ kind: 'ok', path: at('/projects/org'), config: { project: { owner: 'near', number: 2 } } });
  });

  it('goes on past an empty file, and says none when nothing is found', async () => {
    const past = await findRootConfig(start, personal, reader({ [at('/projects/org/app')]: '  \n', [at('/projects')]: PROJECT }));
    expect(past).toMatchObject({ kind: 'ok', path: at('/projects') });
    expect(await findRootConfig(start, personal, reader({}))).toEqual({ kind: 'none' });
  });

  it('reports the nearest file when it cannot be read, and does not fall back to a farther one', async () => {
    const found = await findRootConfig(start, personal, reader({ [at('/projects/org')]: 'project: [', [at('/projects')]: PROJECT }));
    expect(found.kind).toBe('invalid');
    expect(found.kind === 'invalid' && found.path).toBe(at('/projects/org'));
  });

  it('carries the warnings of a file that is read, and never reads the personal file as a root file', async () => {
    const warned = await findRootConfig(start, personal, reader({ [at('/projects')]: `${PROJECT}columns: {}\n` }));
    expect(warned.kind === 'ok' && warned.issues.map((i) => i.code)).toEqual(['root-process-section']);
    const only = await findRootConfig(path.resolve('/home/me/work'), personal, reader({ [personal]: PROJECT }));
    expect(only).toEqual({ kind: 'none' });
  });
});

describe('the example root file', () => {
  const file = path.resolve(__dirname, '../../../examples/operating-root/.weaver/config.yaml');
  const result = parseRootConfig(file, readFileSync(file, 'utf8'));

  it('is valid, with no warning: every agent says its tool and how it is reached', () => {
    expect(result.issues).toEqual([]);
    expect(result.config?.project).toEqual({ owner: 'your-organization', number: 1 });
    expect(result.config?.repositories?.map((r) => r.repository)).toEqual(['your-organization/app', 'your-organization/docs']);
  });

  it('shows each form of reach, and the label is the one Weaver acts on', () => {
    const byId = Object.fromEntries((result.config?.roster?.contributors ?? []).map((c) => [c.id, c]));
    expect(byId['claude-code'].reach).toBe('assigned as the Issue assignee');
    expect(byId['build-agent'].reach).toEqual([{ type: 'label', value: 'owner:build-agent' }]);
    expect(byId['review-agent'].reach).toEqual([
      { type: 'label', value: 'owner:review-agent' },
      { type: 'text', value: 'runs when the label is added, on the office machine' },
    ]);
  });

  it('decides as a root file would', () => {
    const setup = resolveSetup(undefined, undefined, { config: result.config as UserConfig, path: file });
    expect(setup?.source).toBe('root');
    expect(setup?.roster?.contributors.map((c) => c.id)).toEqual(['maria', 'claude-code', 'build-agent', 'review-agent']);
  });
});
