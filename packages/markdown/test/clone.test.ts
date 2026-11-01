import { describe, expect, it } from 'vitest';
import { cloneDirectories, cloneUrl, formatKilobytes, planClones } from '../src';

describe('cloneDirectories', () => {
  it('uses the repository name', () => {
    expect([...cloneDirectories(['o/Weaver', 'o/HowMuchToday'])]).toEqual([
      ['o/Weaver', 'Weaver'],
      ['o/HowMuchToday', 'HowMuchToday'],
    ]);
  });

  it('prefixes the owner when two repositories share a name, ignoring case', () => {
    const map = cloneDirectories(['a/app', 'b/App', 'a/other']);
    expect(map.get('a/app')).toBe('a-app');
    expect(map.get('b/App')).toBe('b-App');
    expect(map.get('a/other')).toBe('other');
  });

  it('never returns a name that points at the root or its parent', () => {
    expect(cloneDirectories(['o/..']).get('o/..')).toBe('o-..');
    expect(cloneDirectories(['.x/.']).get('.x/.')).toBe('_x-.');
  });
});

describe('planClones', () => {
  const repos = ['o/Weaver', 'o/HowMuchToday', 'o/Notes'];

  it('marks a directory that does not exist as missing', () => {
    expect(planClones(repos, new Map()).map((i) => i.state)).toEqual(['missing', 'missing', 'missing']);
  });

  it('skips an existing repository and never plans to overwrite it', () => {
    const items = planClones(repos, { Weaver: 'repository' });
    expect(items.find((i) => i.repository === 'o/Weaver')?.state).toBe('present');
    expect(items.filter((i) => i.state === 'missing').map((i) => i.repository)).toEqual(['o/HowMuchToday', 'o/Notes']);
  });

  it('reports a directory that exists but is not a repository, and does not clone into it', () => {
    const items = planClones(repos, new Map([['Notes', 'other' as const]]));
    expect(items.find((i) => i.repository === 'o/Notes')).toEqual({ repository: 'o/Notes', directory: 'Notes', state: 'not-a-repository' });
  });

  it('keeps the registry order', () => {
    expect(planClones(repos, new Map()).map((i) => i.repository)).toEqual(repos);
  });
});

describe('cloneUrl', () => {
  it('points at GitHub over HTTPS', () => {
    expect(cloneUrl('o/Weaver')).toBe('https://github.com/o/Weaver.git');
  });
});

describe('formatKilobytes', () => {
  it('reads as KB, MB, or GB', () => {
    expect(formatKilobytes(800)).toBe('800 KB');
    expect(formatKilobytes(5 * 1024)).toBe('5.0 MB');
    expect(formatKilobytes(250 * 1024)).toBe('250 MB');
    expect(formatKilobytes(1.5 * 1024 * 1024)).toBe('1.5 GB');
  });
});
