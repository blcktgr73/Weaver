import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { readMarkdownFiles } from '../src/files';

describe('readMarkdownFiles', () => {
  it('reads Markdown with relative paths and skips dependencies, build output, and examples', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-files-'));
    const write = async (relative: string, text: string) => {
      await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await fs.writeFile(path.join(root, relative), text);
    };
    await write('docs/tasks/TASK-001.md', 'one');
    await write('README.md', 'two');
    await write('notes.txt', 'not markdown');
    await write('node_modules/x/README.md', 'skipped');
    await write('examples/sample/tasks/TASK-100.md', 'skipped');
    await write('dist/out.md', 'skipped');

    const files = await readMarkdownFiles(root);
    expect(files.map((f) => f.path).sort()).toEqual(['README.md', 'docs/tasks/TASK-001.md']);
    await fs.rm(root, { recursive: true });
  });
});
