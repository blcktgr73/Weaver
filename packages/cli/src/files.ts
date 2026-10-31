import { promises as fs } from 'fs';
import * as path from 'path';
import type { SourceFile } from '@palab/weaver-markdown';

/** Folders that hold no work of the repository: dependencies, build output, and the sample workspaces. */
const SKIP = new Set(['node_modules', '.git', 'dist', 'out', 'examples']);

/** Every Markdown file under `root`, with `/`-separated paths relative to it. */
export async function readMarkdownFiles(root: string): Promise<SourceFile[]> {
  const found: SourceFile[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) await walk(path.join(directory, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const full = path.join(directory, entry.name);
        found.push({ path: path.relative(root, full).split(path.sep).join('/'), text: await fs.readFile(full, 'utf8') });
      }
    }
  };
  await walk(root);
  return found;
}
