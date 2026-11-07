import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { findRootConfig, ROOT_CONFIG_FILE, ROOT_CONFIG_FOLDER, type RootConfigFound } from '@palab/weaver-markdown';
import { userConfigPath } from './userConfig';

/** The folder the editor starts looking from: the first workspace folder, when it is on this computer (DEC-018 item 2). */
export function workspaceStartFolder(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  return folder?.scheme === 'file' ? folder.fsPath : undefined;
}

/** Reads the nearest root file above the workspace folder. The tool finds the same file (DEC-018 items 2 and 3). */
export async function readRootConfig(): Promise<RootConfigFound> {
  const start = workspaceStartFolder();
  if (!start) return { kind: 'none' };
  return findRootConfig(start, userConfigPath(), (file) => fs.readFile(file, 'utf8').then((text) => text, () => undefined));
}

let detected: string | undefined;

/** The folder that holds the root file that decided last, or nothing. It is the default clone folder (DEC-018 item 8). */
export function detectedRootFolder(): string | undefined {
  return detected;
}

/** Remembers the folder of the root file that decided, so the clone folder can default to it without reading files again. */
export function rememberRootFile(file: string | undefined): void {
  detected = file ? path.dirname(path.dirname(file)) : undefined;
}

export { ROOT_CONFIG_FILE, ROOT_CONFIG_FOLDER };
