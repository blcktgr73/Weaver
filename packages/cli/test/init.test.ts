import { describe, expect, it } from 'vitest';
import { parseConfig } from '@palab/weaver-markdown';
import type { Fetch } from '@palab/weaver-github';
import { EXIT, parseProjectRef, parseSelection, run, type Deps } from '../src';
import { setup } from './helpers';

const issue = (repository: string, number: number, assignees: string[] = []) => ({
  fieldValueByName: { name: 'Todo' },
  content: {
    __typename: 'Issue',
    number,
    title: `Issue ${number}`,
    url: `https://github.com/${repository}/issues/${number}`,
    state: 'OPEN',
    repository: { nameWithOwner: repository },
    labels: { nodes: [] },
    assignees: { nodes: assignees.map((login) => ({ login })) },
  },
});

const node = (number: number, title: string, items: number) => ({ number, title, closed: false, items: { totalCount: items } });

/** GitHub as the setup sees it: two Projects, and four cards in three repositories. */
function github(asked: number[] = []): Fetch {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const query = body.query as string;
    if (query.includes('viewer')) {
      const data = { viewer: { login: 'me', projectsV2: { nodes: [node(7, 'Ops', 4), node(8, 'Side', 1)] }, organizations: { nodes: [] } } };
      return { ok: true, status: 200, json: async () => ({ data }) };
    }
    asked.push(body.variables.n);
    const nodes = [issue('me/a', 1, ['maria']), issue('me/a', 2, ['maria', 'lee']), issue('me/b', 3), issue('other/c', 4)];
    const page = { data: { repositoryOwner: { projectV2: { title: 'Ops', items: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } } };
    return { ok: true, status: 200, json: async () => page };
  };
}

/** A terminal: the answers are given in order, and everything written is kept. */
function terminal(answers: string[], options: { existing?: string; yes?: boolean; asked?: number[] } = {}) {
  const s = setup();
  const written: { file: string; text: string }[] = [];
  const questions: string[] = [];
  const queue = [...answers];
  const deps: Deps = s.deps;
  deps.env = { WEAVER_HOME: '/home/me/.weaver' };
  deps.interactive = true;
  deps.fetch = github(options.asked);
  deps.readText = async (file) => (file.endsWith('config.yaml') ? options.existing : undefined);
  deps.prompt = async (question) => {
    questions.push(question);
    return queue.shift() ?? '';
  };
  deps.ask = async () => options.yes ?? true;
  deps.system.writeFile = async (file, text) => void written.push({ file: file.replace(/\\/g, '/'), text });
  return { ...s, written, questions, queue };
}

const config = (text: string) => parseConfig('config.yaml', text).config;

describe('weaver init', () => {
  it('asks about the Project, the repositories, the roster, and an agent, then writes the personal file', async () => {
    const asked: number[] = [];
    // Project 1 of the list, leave out repository 3, add person 1, add one agent, then finish.
    const t = terminal(['1', '3', '1', 'claude-code', 'Claude Code', "the maintainer's session", ''], { asked });
    expect(await run(['init'], t.deps)).toBe(EXIT.ok);

    expect(asked).toEqual([7]);
    expect(t.written).toHaveLength(1);
    expect(t.written[0].file).toBe('/home/me/.weaver/config.yaml');
    expect(config(t.written[0].text)).toEqual({
      project: { owner: 'me', number: 7 },
      repositories: [{ repository: 'me/a' }, { repository: 'me/b' }],
      roster: {
        contributors: [
          { id: 'maria', kind: 'human', github: 'maria' },
          { id: 'claude-code', kind: 'agent', tool: 'Claude Code', reach: "the maintainer's session" },
        ],
      },
    });
    expect(JSON.parse(t.out.join(''))).toMatchObject({ schema: 1, status: 'written' });
    const shown = t.err.join('');
    expect(shown).toContain('me/7  Ops');
    expect(shown).toContain('me/a  2 cards');
    expect(shown).toContain('maria  2 cards');
  });

  it('writes no repository list when none is left out, so new repositories appear by themselves', async () => {
    const t = terminal(['1', '', '', '']);
    expect(await run(['init'], t.deps)).toBe(EXIT.ok);
    expect(config(t.written[0].text)).toEqual({ project: { owner: 'me', number: 7 } });
  });

  it('takes a Project by its address', async () => {
    const asked: number[] = [];
    const t = terminal(['https://github.com/users/me/projects/3', '', '', ''], { asked });
    expect(await run(['init'], t.deps)).toBe(EXIT.ok);
    expect(asked).toEqual([3]);
    expect(config(t.written[0].text)?.project).toEqual({ owner: 'me', number: 3 });
  });

  it('asks again after an answer it cannot read', async () => {
    const t = terminal(['zzz', '1', 'x', '', '9', '', '']);
    expect(await run(['init'], t.deps)).toBe(EXIT.ok);
    const shown = t.err.join('');
    expect(shown).toContain('"zzz" is not a number in the list');
    expect(shown).toContain('"x" is not a list of numbers from 1 to 3');
    expect(shown).toContain('"9" is not a list of numbers from 1 to 2');
    expect(config(t.written[0].text)?.project.number).toBe(7);
  });

  it('writes nothing when the person says no', async () => {
    const t = terminal(['1', '', '', ''], { yes: false });
    expect(await run(['init'], t.deps)).toBe(EXIT.declined);
    expect(t.written).toEqual([]);
    expect(JSON.parse(t.out.join('')).status).toBe('cancelled');
    expect(t.err.join('')).toContain('Nothing was written.');
  });

  it('starts from the configuration that is there, keeps its roster, and saves a copy of the old file', async () => {
    const existing = 'project: {owner: me, number: 7}\nrepositories: [me/a]\nroster:\n  contributors:\n    - {id: maria, kind: human, github: maria}\n';
    // Enter keeps the Project, Enter keeps what was left out, nobody else is added, no agent.
    const t = terminal(['', '', '', ''], { existing });
    expect(await run(['init'], t.deps)).toBe(EXIT.ok);

    expect(t.written.map((w) => w.file)).toEqual(['/home/me/.weaver/config.yaml.bak', '/home/me/.weaver/config.yaml']);
    expect(t.written[0].text).toBe(existing);
    expect(config(t.written[1].text)).toEqual({
      project: { owner: 'me', number: 7 },
      repositories: [{ repository: 'me/a' }],
      roster: { contributors: [{ id: 'maria', kind: 'human', github: 'maria' }] },
    });
    const shown = t.err.join('');
    expect(shown).toContain('(current)');
    expect(shown).toContain('me/b  1 cards  (left out)');
    expect(shown).toContain('old one is kept as');
    // maria is already in the roster, so only lee is offered.
    expect(shown).toContain('1. lee  1 cards');
    expect(shown).not.toContain('maria  2 cards');
  });

  it('does not add an agent twice', async () => {
    const t = terminal(['1', '', '', 'bot', 't', 'r', 'BOT', '']);
    expect(await run(['init'], t.deps)).toBe(EXIT.ok);
    expect(t.err.join('')).toContain('BOT is already in the roster.');
    expect(config(t.written[0].text)?.roster?.contributors.filter((c) => c.id.toLowerCase() === 'bot')).toHaveLength(1);
  });

  it('needs a terminal and a token', async () => {
    const noTerminal = terminal([]);
    noTerminal.deps.interactive = false;
    expect(await run(['init'], noTerminal.deps)).toBe(EXIT.needsTerminal);
    expect(JSON.parse(noTerminal.out.join('')).error.code).toBe('init.not-interactive');

    const noToken = terminal([]);
    noToken.deps.token = async () => undefined;
    expect(await run(['init'], noToken.deps)).toBe(EXIT.failed);
    expect(JSON.parse(noToken.out.join('')).error.code).toBe('cli.no-token');
  });

  it('stops with the reason when GitHub cannot be read', async () => {
    const t = terminal([]);
    t.deps.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    expect(await run(['init'], t.deps)).toBe(EXIT.failed);
    expect(JSON.parse(t.out.join('')).error.message).toContain('Setup stopped');
  });

  it('asks in Korean on request', async () => {
    const t = terminal(['1', '', '', '']);
    await run(['init', '--lang', 'ko'], t.deps);
    expect(t.questions[0]).toContain('어떤 Project인가요?');
    expect(t.err.join('')).toContain('읽을 수 있는 Project');
  });
});

describe('parseSelection', () => {
  it('reads numbers, ranges, all, and nothing', () => {
    expect(parseSelection('', 5)).toEqual([]);
    expect(parseSelection('  ', 5)).toEqual([]);
    expect(parseSelection('3', 5)).toEqual([3]);
    expect(parseSelection('1, 4 ,2-3', 5)).toEqual([1, 2, 3, 4]);
    expect(parseSelection('2,2,2', 5)).toEqual([2]);
    expect(parseSelection('ALL', 3)).toEqual([1, 2, 3]);
  });

  it('refuses what is not a list of numbers in range', () => {
    expect(parseSelection('0', 5)).toBeUndefined();
    expect(parseSelection('6', 5)).toBeUndefined();
    expect(parseSelection('3-2', 5)).toBeUndefined();
    expect(parseSelection('a', 5)).toBeUndefined();
    expect(parseSelection('1;2', 5)).toBeUndefined();
  });
});

describe('parseProjectRef', () => {
  it('reads the address of a user or organization Project, and owner/number', () => {
    expect(parseProjectRef('https://github.com/users/you/projects/3')).toEqual({ owner: 'you', number: 3 });
    expect(parseProjectRef('https://github.com/orgs/team/projects/7/views/1')).toEqual({ owner: 'team', number: 7 });
    expect(parseProjectRef(' team/7/ ')).toEqual({ owner: 'team', number: 7 });
  });

  it('refuses anything else', () => {
    expect(parseProjectRef('https://github.com/you/repo')).toBeUndefined();
    expect(parseProjectRef('7')).toBeUndefined();
    expect(parseProjectRef('')).toBeUndefined();
  });
});
