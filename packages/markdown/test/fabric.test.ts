import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatNotice, parseFabric, validationKey } from '../src';

const parse = (text: string) => parseFabric('fabric.yaml', text);
const codes = (text: string) => parse(text).issues.map((issue) => issue.code);

const VALID = `project:
  owner: blcktgr73
  number: 1
repositories:
  - blcktgr73/Weaver
  - repository: blcktgr73/HowMuchToday
    title: How much today
`;

describe('parseFabric', () => {
  it('reads the project and both entry forms', () => {
    const { registry, issues } = parse(VALID);
    expect(issues).toEqual([]);
    expect(registry).toEqual({
      project: { owner: 'blcktgr73', number: 1 },
      repositories: [{ repository: 'blcktgr73/Weaver' }, { repository: 'blcktgr73/HowMuchToday', title: 'How much today' }],
    });
  });

  it('keeps the order of the repositories, which is the lane order', () => {
    const { registry } = parse('project: {owner: a, number: 2}\nrepositories: [a/z, a/b, a/m]\n');
    expect(registry?.repositories.map((r) => r.repository)).toEqual(['a/z', 'a/b', 'a/m']);
  });

  it('accepts an organization as the Project owner', () => {
    const { registry } = parse('project: {owner: my-org, number: 7}\nrepositories: [my-org/app]\n');
    expect(registry?.project).toEqual({ owner: 'my-org', number: 7 });
  });

  it('reports YAML that does not parse', () => {
    expect(codes('project: [unclosed')).toEqual(['fabric-invalid-yaml']);
  });

  it('rejects a file that is not a mapping', () => {
    expect(codes('- a/b\n')).toEqual(['fabric-not-a-mapping']);
    expect(codes('')).toEqual(['fabric-not-a-mapping']);
  });

  it('requires the project and the repositories', () => {
    const { registry, issues } = parse('foo: 1\n');
    expect(registry).toBeUndefined();
    expect(issues.filter((i) => i.severity === 'error').map((i) => [i.code, i.args?.field])).toEqual([
      ['missing-field', 'project'],
      ['missing-field', 'repositories'],
    ]);
  });

  it('checks the project owner and number', () => {
    expect(codes('project: {number: 1}\nrepositories: [a/b]\n')).toEqual(['missing-field']);
    expect(codes('project: {owner: "-bad", number: 1}\nrepositories: [a/b]\n')).toEqual(['fabric-invalid-project-owner']);
    expect(codes('project: {owner: a}\nrepositories: [a/b]\n')).toEqual(['missing-field']);
    for (const number of ['0', '-1', '1.5', '"1"']) {
      expect(codes(`project: {owner: a, number: ${number}}\nrepositories: [a/b]\n`)).toEqual(['fabric-invalid-project-number']);
    }
    expect(codes('project: a\nrepositories: [a/b]\n')).toEqual(['fabric-project-not-a-mapping']);
  });

  it('rejects a missing, empty, or non-list repositories value', () => {
    expect(codes('project: {owner: a, number: 1}\nrepositories: []\n')).toEqual(['fabric-no-repositories']);
    expect(codes('project: {owner: a, number: 1}\nrepositories: a/b\n')).toEqual(['fabric-repositories-not-a-list']);
  });

  it('rejects a malformed or duplicate repository', () => {
    const head = 'project: {owner: a, number: 1}\nrepositories:\n';
    expect(codes(head + '  - just-a-name\n')).toEqual(['invalid-repository']);
    expect(codes(head + '  - title: only a title\n')).toEqual(['fabric-invalid-repository-entry']);
    expect(codes(head + '  - 42\n')).toEqual(['fabric-invalid-repository-entry']);
    expect(codes(head + '  - a/b\n  - A/B\n')).toEqual(['fabric-duplicate-repository']);
  });

  it('warns about unknown fields but still returns the registry', () => {
    const { registry, issues } = parse(VALID + 'lanes: []\n');
    expect(registry).toBeDefined();
    expect(issues).toEqual([{ severity: 'warning', code: 'unknown-field', args: { field: 'lanes' }, path: 'fabric.yaml' }]);
  });

  it('returns no registry when there is an error, even if the rest is valid', () => {
    expect(parse('project: {owner: a, number: 0}\nrepositories: [a/b]\n').registry).toBeUndefined();
  });

  it('labels every issue with the path it was given', () => {
    const result = parseFabric('team/fabric.yaml', 'x');
    expect(result.issues.every((issue) => issue.path === 'team/fabric.yaml')).toBe(true);
  });

  it('has a readable message in English and Korean for every code', () => {
    const bad = [
      'project: [unclosed', '- a', 'project: a\nrepositories: x\n', 'project: {owner: "-", number: 0}\nrepositories: []\n',
      'project: {owner: a, number: 1}\nrepositories: [a, 7, a/b, a/b]\n',
    ];
    for (const text of bad) {
      for (const issue of parse(text).issues) {
        for (const locale of ['en', 'ko'] as const) {
          const message = formatNotice({ code: validationKey(issue.code), args: issue.args }, locale);
          expect(message).not.toBe(validationKey(issue.code));
          expect(message).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });
});

describe('this repository', () => {
  it('has a valid example registry for the development host', () => {
    const text = readFileSync(resolve(__dirname, '../../../examples/overview/fabric.yaml'), 'utf8');
    expect(parseFabric('fabric.yaml', text).issues).toEqual([]);
  });

  it('keeps no personal registry at its root: a registry belongs to the person who uses it (DEC-014)', () => {
    expect(existsSync(resolve(__dirname, '../../../fabric.yaml'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../../../roster.yaml'))).toBe(false);
  });
});
