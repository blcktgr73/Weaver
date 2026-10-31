import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatNotice, Locale, MessageKey, Notice, t } from '@palab/weaver-markdown';
import { Deps, EXIT, SCHEMA } from './contract';

/**
 * One write, described before it runs (DEC-008). Nothing in `run` happens until the action is
 * approved, so a plan can be built, shown, and thrown away without touching GitHub or a file.
 */
export interface PlannedAction {
  /** What kind of change, such as `project.add`. */
  kind: string;
  /** What it changes, such as `me/Weaver#12`. */
  target: string;
  /** The exact change, as a person should read it. */
  summary: Notice;
  /** Why the steward proposes it. */
  reason: Notice;
  /** Actions that must have succeeded first; this one is skipped otherwise. */
  dependsOn?: PlannedAction[];
  run(): Promise<void>;
}

export type Outcome = 'done' | 'failed' | 'declined' | 'unconfirmed' | 'skipped';

export interface ActionResult {
  id: string;
  kind: string;
  target: string;
  summary: string;
  reason: string;
  outcome: Outcome;
  /** The error of a failed action. */
  message?: string;
}

/** One line of the local action log: who or what did it, to what, and why. */
export interface LogEntry {
  time: string;
  actor: string;
  onBehalfOf?: string;
  action: string;
  target: string;
  reason: string;
  outcome: 'done' | 'failed';
  message?: string;
}

export interface ActionLog {
  append(entry: LogEntry): Promise<void>;
}

/**
 * The approval token of an action: it names the kind, the target, and the exact change, so an
 * approval of one action cannot be reused for another.
 */
export function actionId(action: Pick<PlannedAction, 'kind' | 'target' | 'summary'>): string {
  const text = `${action.kind}\n${action.target}\n${formatNotice(action.summary, 'en')}`;
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** `~/.weaver/actions.jsonl`, or under `WEAVER_HOME`. Never inside a repository. */
export function defaultLogPath(env: Record<string, string | undefined>): string {
  return path.join(env.WEAVER_HOME ?? path.join(os.homedir(), '.weaver'), 'actions.jsonl');
}

export function fileActionLog(file: string): ActionLog {
  return {
    async append(entry) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
    },
  };
}

/** The line that anything created on GitHub carries, so the steward's work is told from the user's. */
export function attribution(locale: Locale, login: string | undefined): string {
  return login ? t('steward.attribution', locale, { login }) : t('steward.attribution-anonymous', locale);
}

export interface ExecuteContext {
  locale: Locale;
  /** Ids the user approved ahead of time, from `--approve`. */
  approved: ReadonlySet<string>;
  interactive: boolean;
  ask(question: string): Promise<boolean>;
  log: ActionLog;
  actor: string;
  onBehalfOf?: string;
  now(): Date;
  /** Where the plan is shown while it waits: the error stream, so standard output stays JSON. */
  note(text: string): void;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Runs the plan one action at a time. An action runs only when its id was approved up front or the
 * person says yes to it. An action that was neither approved nor answered is `unconfirmed`, one
 * that was refused is `declined`, and neither changes anything. The first failure stops the rest.
 */
export async function executeActions(actions: readonly PlannedAction[], ctx: ExecuteContext): Promise<ActionResult[]> {
  const results = new Map<PlannedAction, ActionResult>();
  let stopped = false;

  for (const action of actions) {
    const id = actionId(action);
    const result: ActionResult = {
      id,
      kind: action.kind,
      target: action.target,
      summary: formatNotice(action.summary, ctx.locale),
      reason: formatNotice(action.reason, ctx.locale),
      outcome: 'skipped',
    };
    results.set(action, result);

    const blocked = stopped || (action.dependsOn ?? []).some((needed) => results.get(needed)?.outcome !== 'done');
    if (blocked) continue;

    ctx.note(`${t('cli.action-line', ctx.locale, { id, kind: result.kind, target: result.target, summary: result.summary, reason: result.reason })}\n`);

    let approved = ctx.approved.has(id);
    if (!approved && ctx.interactive) {
      approved = await ctx.ask(t('cli.confirm', ctx.locale));
      if (!approved) {
        result.outcome = 'declined';
        continue;
      }
    }
    if (!approved) {
      result.outcome = 'unconfirmed';
      continue;
    }

    const entry = { time: ctx.now().toISOString(), actor: ctx.actor, ...(ctx.onBehalfOf ? { onBehalfOf: ctx.onBehalfOf } : {}), action: action.kind, target: action.target, reason: formatNotice(action.reason, 'en') };
    try {
      await action.run();
      result.outcome = 'done';
      await ctx.log.append({ ...entry, outcome: 'done' });
    } catch (error) {
      result.outcome = 'failed';
      result.message = errorText(error);
      stopped = true;
      await ctx.log.append({ ...entry, outcome: 'failed', message: result.message }).catch(() => undefined);
    }
  }
  return [...results.values()];
}

/** A failure comes first, then a refusal, then waiting for approval; nothing to do is a success. */
export function exitCodeOf(results: readonly ActionResult[]): number {
  if (results.some((r) => r.outcome === 'failed')) return EXIT.failed;
  if (results.some((r) => r.outcome === 'declined')) return EXIT.declined;
  if (results.some((r) => r.outcome === 'unconfirmed')) return EXIT.unconfirmed;
  return EXIT.ok;
}

/** Everything a write command prints at the end, and the exit code it returns. */
export interface Skipped {
  ref: string;
  reason: string;
}

export function finishActions(
  results: readonly ActionResult[],
  deps: Pick<Deps, 'out' | 'err'>,
  locale: Locale,
  text: boolean,
  skipped: readonly Skipped[] = [],
): number {
  const code = exitCodeOf(results);
  if (text) {
    for (const s of skipped) deps.err(`${t(`cli.skip.${s.reason}` as MessageKey, locale)}\t${s.ref}\n`);
    for (const r of results) deps.out(`${t(`cli.outcome.${r.outcome}`, locale)}\t${r.kind}\t${r.target}${r.message ? `\t${r.message}` : ''}\n`);
    const waiting = results.filter((r) => r.outcome === 'unconfirmed').map((r) => r.id);
    if (waiting.length) deps.err(`${t('cli.unconfirmed-hint', locale, { ids: waiting.join(',') })}\n`);
  } else {
    const status = results.length === 0 ? 'nothing' : code === EXIT.failed ? 'failed' : code === EXIT.declined ? 'declined' : code === EXIT.unconfirmed ? 'unconfirmed' : 'done';
    deps.out(`${JSON.stringify({ schema: SCHEMA, status, actions: results, skipped })}\n`);
  }
  return code;
}

/** The ids of `--approve a,b,c`. */
export function parseApproved(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((id) => id.trim()).filter(Boolean));
}
