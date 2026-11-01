import { describe, expect, it } from 'vitest';
import { effectiveRepositories, parseConfig, parseFabric, resolveSetup } from '../src';

const parse = (text: string) => parseConfig('config.yaml', text);
const codes = (text: string) => parse(text).issues.map((i) => `${i.severity}:${i.code}`);
const fabric = (text: string) => {
  const registry = parseFabric('fabric.yaml', text).registry;
  if (!registry) throw new Error('bad registry');
  return registry;
};

const PROJECT = 'project: {owner: me, number: 1}\n';

describe('parseConfig', () => {
  it('reads a Project alone, because the repositories can be taken from the Project', () => {
    const result = parse(PROJECT);
    expect(result.config).toEqual({ project: { owner: 'me', number: 1 } });
    expect(result.issues).toEqual([]);
  });

  it('reads the Project, the repositories, and the roster', () => {
    const result = parse(`${PROJECT}repositories:\n  - me/a\n  - {repository: me/b, title: B}\nroster:\n  contributors:\n    - id: maria\n      kind: human\n`);
    expect(result.config?.repositories).toEqual([{ repository: 'me/a' }, { repository: 'me/b', title: 'B' }]);
    expect(result.config?.roster?.contributors).toEqual([{ id: 'maria', kind: 'human' }]);
  });

  it('reports what is wrong and gives no configuration when there are errors', () => {
    expect(codes('a: [unclosed')).toEqual(['error:config-invalid-yaml']);
    expect(codes('- a')).toEqual(['error:config-not-a-mapping']);
    expect(codes('repositories: [me/a]')).toEqual(['error:missing-field']);
    expect(codes(`${PROJECT}repositories: []`)).toEqual(['error:fabric-no-repositories']);
    expect(codes(`${PROJECT}repositories: [bad]`)).toEqual(['error:invalid-repository']);
    expect(codes(`${PROJECT}roster:\n  contributors: x`)).toEqual(['error:roster-not-a-list']);
    expect(parse(`${PROJECT}repositories: []`).config).toBeUndefined();
  });

  it('keeps a configuration that has only warnings', () => {
    const result = parse(`${PROJECT}colour: blue\nroster:\n  contributors:\n    - {id: bot, kind: agent}\n`);
    expect(result.config?.roster?.contributors).toHaveLength(1);
    expect(result.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(['warning:unknown-field', 'warning:roster-agent-incomplete', 'warning:roster-agent-incomplete']);
  });

  it('treats an empty repositories or roster entry as left out', () => {
    expect(parse(`${PROJECT}repositories:\nroster:\n`).config).toEqual({ project: { owner: 'me', number: 1 } });
  });
});

describe('resolveSetup', () => {
  const user = parse(`${PROJECT}repositories: [me/mine]\nroster:\n  contributors:\n    - {id: maria, kind: human}\n`).config;
  const shared = fabric('project: {owner: team, number: 7}\nrepositories:\n  - team/app\n');

  it('uses the personal file when the workspace has none', () => {
    expect(resolveSetup(undefined, user)).toMatchObject({ source: 'user', project: { owner: 'me', number: 1 }, repositories: [{ repository: 'me/mine' }] });
  });

  it('lets a workspace fabric.yaml decide the Project and the repositories, but keeps the personal roster', () => {
    const setup = resolveSetup(shared, user);
    expect(setup?.source).toBe('workspace');
    expect(setup?.project).toEqual({ owner: 'team', number: 7 });
    expect(setup?.repositories).toEqual([{ repository: 'team/app' }]);
    expect(setup?.roster?.contributors[0].id).toBe('maria');
  });

  it('works from the workspace file alone, and from nothing', () => {
    expect(resolveSetup(shared, undefined)?.roster).toBeUndefined();
    expect(resolveSetup(undefined, undefined)).toBeUndefined();
  });

  it('leaves the repositories out when the personal file gives none', () => {
    expect(resolveSetup(undefined, parse(PROJECT).config)?.repositories).toBeUndefined();
  });
});

describe('effectiveRepositories', () => {
  it('uses the given list as it is', () => {
    expect(effectiveRepositories({ repositories: [{ repository: 'me/b' }, { repository: 'me/a' }] }, ['x/y'])).toEqual([{ repository: 'me/b' }, { repository: 'me/a' }]);
  });

  it('takes every repository of the cards when there is no list, once each, in alphabetical order', () => {
    expect(effectiveRepositories({}, ['me/b', 'me/A', 'me/a', 'me/c', 'me/B'])).toEqual([{ repository: 'me/A' }, { repository: 'me/b' }, { repository: 'me/c' }]);
    expect(effectiveRepositories({}, [])).toEqual([]);
  });
});
