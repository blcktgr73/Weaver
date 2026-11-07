import { describe, expect, it } from 'vitest';
import {
  clonesWithoutCards,
  makeRepositoryList,
  originOfGitConfig,
  readRepositoryList,
  repositoryListIsOld,
  repositoryOfRemote,
  snapshotAge,
} from '../src';

describe('repositoryOfRemote', () => {
  it('reads the common forms of a GitHub address', () => {
    expect(repositoryOfRemote('https://github.com/ebrAIn-Lab-3B/Weaver.git')).toBe('ebrAIn-Lab-3B/Weaver');
    expect(repositoryOfRemote('https://github.com/ebrAIn-Lab-3B/Weaver')).toBe('ebrAIn-Lab-3B/Weaver');
    expect(repositoryOfRemote('https://user@github.com/o/n.git')).toBe('o/n');
    expect(repositoryOfRemote('git@github.com:o/my.repo.git')).toBe('o/my.repo');
    expect(repositoryOfRemote('ssh://git@github.com/o/n.git')).toBe('o/n');
    expect(repositoryOfRemote(' https://github.com/o/n/ ')).toBe('o/n');
  });

  it('leaves other hosts and other shapes alone', () => {
    expect(repositoryOfRemote('https://gitlab.com/o/n.git')).toBeUndefined();
    expect(repositoryOfRemote('https://github.com/o')).toBeUndefined();
    expect(repositoryOfRemote('https://evil.example/github.com/o/n.git')).toBeUndefined();
    expect(repositoryOfRemote('/home/me/projects/n')).toBeUndefined();
  });
});

describe('originOfGitConfig', () => {
  const config = (body: string) => `[core]\n\trepositoryformatversion = 0\n${body}[branch "main"]\n\tremote = origin\n`;

  it('takes the url of the origin remote', () => {
    expect(originOfGitConfig(config('[remote "origin"]\n\turl = https://github.com/o/n.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n'))).toBe('o/n');
  });

  it('ignores other remotes, handles CRLF, and gives nothing when there is no origin or it is elsewhere', () => {
    expect(originOfGitConfig(config('[remote "upstream"]\n\turl = https://github.com/x/y.git\n'))).toBeUndefined();
    expect(originOfGitConfig(config('[remote "upstream"]\n\turl = https://github.com/x/y.git\n[remote "origin"]\n\turl = git@github.com:o/n.git\n').replace(/\n/g, '\r\n'))).toBe('o/n');
    expect(originOfGitConfig(config('[remote "origin"]\n\turl = https://gitlab.com/o/n.git\n'))).toBeUndefined();
    expect(originOfGitConfig(config(''))).toBeUndefined();
  });
});

describe('clonesWithoutCards', () => {
  it('keeps the clones that are neither listed nor on the Project, without regard to case', () => {
    expect(clonesWithoutCards(['o/a', 'o/B', 'o/c', 'o/d'], ['O/A'], ['o/b'])).toEqual(['o/c', 'o/d']);
  });

  it('lists a clone once and keeps the order of the first mention', () => {
    expect(clonesWithoutCards(['o/z', 'O/Z', 'o/y'], [], [])).toEqual(['o/z', 'o/y']);
  });

  it('gives nothing when every clone is accounted for', () => {
    expect(clonesWithoutCards(['o/a'], ['o/a'], [])).toEqual([]);
    expect(clonesWithoutCards([], ['o/a'], ['o/b'])).toEqual([]);
  });
});

describe('the saved repository list', () => {
  const project = { owner: 'Team', number: 3 };
  const now = new Date('2026-11-08T00:00:00Z');

  it('counts the cards of each repository, once per spelling, the busiest first', () => {
    const list = makeRepositoryList(project, ['o/b', 'o/a', 'O/A', 'o/a'], now);
    expect(list.repositories).toEqual([
      { name: 'o/a', cards: 3 },
      { name: 'o/b', cards: 1 },
    ]);
    expect(list).toMatchObject({ version: 1, project: { owner: 'Team', number: 3 }, readAt: '2026-11-08T00:00:00.000Z' });
  });

  it('is read back for the same Project, and ignored for another, a broken date, or odd rows', () => {
    const list = JSON.parse(JSON.stringify(makeRepositoryList(project, ['o/a'], now)));
    expect(readRepositoryList(list, { owner: 'team', number: 3 })).toEqual(list);
    expect(readRepositoryList(list, { owner: 'team', number: 4 })).toBeUndefined();
    expect(readRepositoryList(list, { owner: 'other', number: 3 })).toBeUndefined();
    expect(readRepositoryList({ ...list, readAt: 'later' }, project)).toBeUndefined();
    expect(readRepositoryList({ ...list, repositories: [{ name: 'nope', cards: 1 }] }, project)).toBeUndefined();
    expect(readRepositoryList({ ...list, version: 2 }, project)).toBeUndefined();
    expect(readRepositoryList(null, project)).toBeUndefined();
  });

  it('is old after 24 hours and not before', () => {
    const at = (hours: number) => new Date(now.getTime() + hours * 3600 * 1000);
    expect(repositoryListIsOld(now.toISOString(), at(23.9))).toBe(false);
    expect(repositoryListIsOld(now.toISOString(), at(24))).toBe(false);
    expect(repositoryListIsOld(now.toISOString(), at(24.1))).toBe(true);
    expect(repositoryListIsOld(now.toISOString(), at(30), 48)).toBe(false);
  });

  it('shows its age with the same words as the kept board', () => {
    expect(snapshotAge(now.toISOString(), new Date(now.getTime() + 3 * 3600 * 1000))).toEqual({ unit: 'hours', count: 3 });
  });
});
