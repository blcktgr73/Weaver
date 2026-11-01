#!/usr/bin/env node
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { defaultLogPath, fileActionLog } from './actions';
import { readMarkdownFiles } from './files';
import { run } from './run';

/** The token of the `gh` login (DEC-008). It is never stored by this tool. */
function ghToken(): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('gh', ['auth', 'token'], { timeout: 15000 }, (error, stdout) => resolve(error ? undefined : stdout.trim() || undefined));
  });
}

function runProgram(command: 'git' | 'gh', args: string[], options?: { cwd?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: options?.cwd, timeout: 120000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (error, stdout, stderr) =>
      error ? reject(new Error(`${command} ${args[0]} failed: ${(stderr || error.message).trim()}`)) : resolve(stdout),
    );
  });
}

function ghLogin(): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('gh', ['api', 'user', '--jq', '.login'], { timeout: 15000 }, (error, stdout) => resolve(error ? undefined : stdout.trim() || undefined));
  });
}

/** The question goes to standard error so that standard output stays JSON. */
function ask(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(/^y(es)?$/i.test(answer.trim()));
  }));
}

/** One line typed by the person. The question goes to standard error so that standard output stays JSON. */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

void run(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
  token: ghToken,
  login: ghLogin,
  files: readMarkdownFiles,
  readText: (file) => fs.readFile(file, 'utf8').then((text) => text, () => undefined),
  now: () => new Date(),
  interactive: Boolean(process.stdin.isTTY),
  ask,
  prompt,
  log: fileActionLog(defaultLogPath(process.env)),
  system: {
    run: runProgram,
    tempDir: async () => path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'weaver-')), 'work'),
    readText: (file) => fs.readFile(file, 'utf8').then((text) => text, () => undefined),
    writeFile: async (file, text) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, text, 'utf8');
    },
  },
}).then((code) => {
  process.exitCode = code;
});
