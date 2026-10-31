#!/usr/bin/env node
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { readMarkdownFiles } from './files';
import { run } from './run';

/** The token of the `gh` login (DEC-008). It is never stored by this tool. */
function ghToken(): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('gh', ['auth', 'token'], { timeout: 15000 }, (error, stdout) => resolve(error ? undefined : stdout.trim() || undefined));
  });
}

void run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
  token: ghToken,
  files: readMarkdownFiles,
  readText: (file) => fs.readFile(file, 'utf8').then((text) => text, () => undefined),
  now: () => new Date(),
}).then((code) => {
  process.exitCode = code;
});
