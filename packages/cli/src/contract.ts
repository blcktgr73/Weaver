import type { Fetch } from '@palab/weaver-github';
import type { SourceFile } from '@palab/weaver-markdown';
import type { ActionLog } from './actions';

/** The version of the JSON that every command prints. A change that breaks a reader raises it. */
export const SCHEMA = 1;

/**
 * Exit codes. 4 and 5 are the two ways a write ends without changing anything: nobody confirmed it
 * (an agent has to show the plan to the user and run again with `--approve`), or the user said no.
 * 6 is a command that asks questions and was run without a terminal.
 */
export const EXIT = { ok: 0, failed: 1, usage: 2, notFound: 3, unconfirmed: 4, declined: 5, needsTerminal: 6 } as const;

/** The programs and files a write command uses, so a test can replace them. */
export interface System {
  /** Runs `git` or `gh` and returns what it printed; rejects when it fails. */
  run(command: 'git' | 'gh', args: string[], options?: { cwd?: string }): Promise<string>;
  tempDir(): Promise<string>;
  readText(file: string): Promise<string | undefined>;
  writeFile(file: string, text: string): Promise<void>;
}

/** Everything the commands touch outside the process, so a test can replace it. */
export interface Deps {
  cwd: string;
  env: Record<string, string | undefined>;
  out(text: string): void;
  err(text: string): void;
  /** The GitHub token of the signed-in `gh` login, or undefined. */
  token(): Promise<string | undefined>;
  /** The login the token belongs to, named in what the steward creates. */
  login(): Promise<string | undefined>;
  fetch?: Fetch;
  files(root: string): Promise<SourceFile[]>;
  readText(file: string): Promise<string | undefined>;
  now(): Date;
  /** True when a person can answer a question on the terminal. */
  interactive: boolean;
  /** Asks the person one yes/no question; false for anything but yes. */
  ask(question: string): Promise<boolean>;
  /** Asks the person a question and returns what they typed. */
  prompt(question: string): Promise<string>;
  /** Where each executed action is recorded. */
  log: ActionLog;
  system: System;
}
