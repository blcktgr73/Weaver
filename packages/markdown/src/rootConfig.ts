import * as path from 'path';
import { ConfigParseResult, parseConfig } from './config';

/** The folder and the file name of a root file: `<folder>/.weaver/config.yaml` (DEC-018 item 1). */
export const ROOT_CONFIG_FOLDER = '.weaver';
export const ROOT_CONFIG_FILE = 'config.yaml';

/**
 * Sections that describe how a repository tracks its work. A root file does not carry them: the
 * repository is the single source of truth for its process (DEC-015 item 2, DEC-018 item 7).
 */
export const ROOT_PROCESS_SECTIONS = ['version', 'columns', 'evidence', 'stale', 'task'] as const;

/**
 * Reads a root file. It has the keys of the personal file (DEC-018 item 1); a process section in it is
 * reported with its own warning and is not applied, instead of the general "unknown field" one.
 */
export function parseRootConfig(filePath: string, text: string): ConfigParseResult {
  const result = parseConfig(filePath, text);
  return {
    ...result,
    issues: result.issues.map((issue) =>
      issue.code === 'unknown-field' && (ROOT_PROCESS_SECTIONS as readonly string[]).includes(String(issue.args?.field))
        ? { ...issue, code: 'root-process-section' }
        : issue,
    ),
  };
}

/** Whether two paths name the same place: resolved, and without regard to case on Windows. */
const samePath = (a: string, b: string): boolean => {
  const x = path.resolve(a);
  const y = path.resolve(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
};

/**
 * The places a root file may be, nearest first: the start folder and each of its parents up to the top
 * of the file system (DEC-018 item 2). The personal file is left out, because it is the last layer
 * already and would otherwise be counted twice (item 3).
 */
export function rootConfigCandidates(start: string, personalFile: string): string[] {
  const found: string[] = [];
  let folder = path.resolve(start);
  for (;;) {
    const file = path.join(folder, ROOT_CONFIG_FOLDER, ROOT_CONFIG_FILE);
    if (!samePath(file, personalFile)) found.push(file);
    const parent = path.dirname(folder);
    if (parent === folder) return found;
    folder = parent;
  }
}
