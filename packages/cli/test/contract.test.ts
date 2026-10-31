import { promises as fs } from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { EXIT, run } from '../src';
import { setup, withGitHub } from './helpers';

const DOC = path.resolve(__dirname, '../../../docs/onboarding/agent-contract.md');

/** What a JSON value looks like: the keys of an object, the type of a scalar, the first item of an array. */
function shapeOf(value: unknown): unknown {
  if (Array.isArray(value)) return value.length ? [shapeOf(value[0])] : [];
  if (value === null) return 'null';
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value as object).sort().map((key) => [key, shapeOf((value as Record<string, unknown>)[key])]));
  return typeof value;
}

/** The examples of the page: the JSON block after each `<!-- example: name -->`. */
function examples(text: string): Map<string, unknown> {
  const found = new Map<string, unknown>();
  for (const match of text.matchAll(/<!-- example: ([\w-]+) -->\s*```json\n([\s\S]*?)\n```/g)) found.set(match[1], JSON.parse(match[2]));
  return found;
}

/** The command that each example documents, run against the test double of the tool. */
const COMMANDS: Record<string, { args: string[]; github?: boolean; approveFrom?: string[] }> = {
  notfound: { args: ['show', 'TASK-999'] },
  list: { args: ['list'] },
  show: { args: ['show', 'TASK-010'] },
  move: { args: ['card', 'move', 'me/Weaver#10', '--to', 'review'], github: true },
  'add-approved': { args: ['project', 'add', 'me/Weaver#12'], approveFrom: ['project', 'add', 'me/Weaver#12'] },
  task: { args: ['task', 'create', '--title', 'Add the export button', '--requirement', 'REQ-001', '--criteria', 'AC-001'] },
  reconcile: { args: ['reconcile'] },
};

describe('docs/onboarding/agent-contract.md', () => {
  it('has an example for every command it documents, and nothing else', async () => {
    const found = examples(await fs.readFile(DOC, 'utf8'));
    expect([...found.keys()].sort()).toEqual(Object.keys(COMMANDS).sort());
  });

  for (const [name, command] of Object.entries(COMMANDS)) {
    it(`shows the JSON that "${command.args.join(' ')}" really prints (${name})`, async () => {
      const documented = examples(await fs.readFile(DOC, 'utf8')).get(name);

      const args = [...command.args];
      if (command.approveFrom) {
        const plan = setup();
        await run(command.approveFrom, plan.deps);
        args.push('--approve', JSON.parse(plan.out.join('')).actions[0].id);
      }
      const { deps, out } = setup();
      if (command.github) withGitHub(deps);
      await run(args, deps);
      const actual = JSON.parse(out.join('').trim().split('\n')[0]);

      expect(shapeOf(documented)).toEqual(shapeOf(actual));
      expect((documented as { schema: number }).schema).toBe(actual.schema);
    });
  }

  it('lists every command and every exit code', async () => {
    const text = await fs.readFile(DOC, 'utf8');
    for (const command of ['weaver list', 'weaver show', 'weaver project add', 'weaver task create', 'weaver card move', 'weaver evidence attach', 'weaver reconcile']) {
      expect(text).toContain(command);
    }
    for (const code of Object.values(EXIT)) expect(text).toMatch(new RegExp(`^\\| ${code} \\|`, 'm'));
  });

  it('keeps the rules of DEC-008 in front of an agent', async () => {
    const text = await fs.readFile(DOC, 'utf8');
    expect(text).toContain('There is no `--yes`');
    expect(text).toContain('Never approve an action the user has not seen');
    expect(text).toContain('commit to a default branch');
  });
});
