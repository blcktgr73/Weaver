import { promises as fs } from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { defaultProcess, parseProcess } from '@palab/weaver-markdown';

const ROOT = path.resolve(__dirname, '../../..');

// A checkout on Windows may turn line breaks into CRLF.
const read = async (file: string) => (await fs.readFile(path.join(ROOT, file), 'utf8')).replace(/\r\n/g, '\n');

describe("this repository's own .weaver/process.yaml", () => {
  it('is valid, sets every section, and spells out exactly the defaults, so it changes no behavior', async () => {
    const result = parseProcess('.weaver/process.yaml', await read('.weaver/process.yaml'));
    expect(result.issues).toEqual([]);
    expect(result.sources).toEqual({ columns: 'repository', evidence: 'repository', stale: 'repository', task: 'default' });
    expect(result.process).toEqual(defaultProcess());
  });
});

describe('docs/onboarding/configure-your-process.md', () => {
  it('has only YAML examples that Weaver reads without a problem', async () => {
    const text = await read('docs/onboarding/configure-your-process.md');
    const blocks = [...text.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map((match) => match[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(6);
    for (const block of blocks) {
      expect(parseProcess('example.yaml', block).issues, block).toEqual([]);
    }
  });

  it('says what its worked example does, and the example does it', async () => {
    const text = await read('docs/onboarding/configure-your-process.md');
    const example = [...text.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map((match) => match[1]).find((block) => block.includes('board-status') && block.includes('optional'));
    expect(example).toBeDefined();
    const { process } = parseProcess('example.yaml', example as string);
    expect(process.columns.source).toBe('board-status');
    expect(process.evidence).toEqual({ pullRequest: 'optional', closingPullRequest: false, exceptions: true });
  });

  it('has an example of the task section that declares its fields without a problem', async () => {
    const text = await read('docs/onboarding/configure-your-process.md');
    const block = [...text.matchAll(/```yaml\n([\s\S]*?)\n```/g)].map((match) => match[1]).find((b) => b.includes('task:') && b.includes('fields:'));
    expect(block).toBeDefined();
    const result = parseProcess('example.yaml', block as string);
    expect(result.issues).toEqual([]);
    expect(result.sources.task).toBe('repository');
    expect(result.process.task.fields.map((field) => field.name)).toEqual(['owner', 'priority']);
  });
});
