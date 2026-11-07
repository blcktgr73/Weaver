import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatNotice, parseConfig, parseFabric, parseRootConfig, resolveSetup, rootConfigCandidates, type RootConfig, type UserConfig } from '../src';

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
