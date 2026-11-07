import * as path from 'path';
import { ConfigParseResult, parseConfig, type UserConfig } from './config';
import type { ValidationIssue } from './types';

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

/** What looking for a root file found (DEC-018 item 2). */
export type RootConfigFound =
  | { kind: 'none' }
  /** The nearest file exists but cannot be read: reported, not skipped, so a typo does not quietly fall back to another file. */
  | { kind: 'invalid'; path: string; issues: ValidationIssue[] }
  | { kind: 'ok'; path: string; config: UserConfig; /** Warnings of the file, for example a process section. */ issues: ValidationIssue[] };

/**
 * Looks for the nearest root file from `start` and reads it. `readText` returns the text of a file, or
 * `undefined` when there is none; an empty file counts as none and the walk goes on. The editor and the
 * tool both call this, so they find the same file.
 */
export async function findRootConfig(start: string, personalFile: string, readText: (file: string) => Promise<string | undefined>): Promise<RootConfigFound> {
  for (const file of rootConfigCandidates(start, personalFile)) {
    const text = await readText(file);
    if (text === undefined || text.trim() === '') continue;
    const parsed = parseRootConfig(file, text);
    return parsed.config ? { kind: 'ok', path: file, config: parsed.config, issues: parsed.issues } : { kind: 'invalid', path: file, issues: parsed.issues };
  }
  return { kind: 'none' };
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
