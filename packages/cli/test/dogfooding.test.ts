import { promises as fs } from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');
const read = async (file: string) => (await fs.readFile(path.join(ROOT, file), 'utf8')).replace(/\r\n/g, '\n');

describe('the feedback form of the first round', () => {
  it('asks what the person was doing, expected, and saw, and how much it got in the way', async () => {
    const form = parse(await read('.github/ISSUE_TEMPLATE/dogfooding-feedback.yml')) as { name: string; description: string; labels: string[]; body: { type: string; id?: string; validations?: { required: boolean } }[] };
    expect(form.name).toBeTruthy();
    expect(form.description).toBeTruthy();
    const required = form.body.filter((item) => item.validations?.required).map((item) => item.id);
    expect(required).toEqual(['doing', 'expected', 'happened', 'impact']);
    // GitHub rejects a form whose ids repeat.
    const ids = form.body.flatMap((item) => (item.id ? [item.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is the template the guide links to', async () => {
    const guide = await read('docs/onboarding/dogfooding-round-1.md');
    expect(guide).toContain('template=dogfooding-feedback.yml');
  });
});
