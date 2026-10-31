import {
  describeMove,
  evidenceGaps,
  formatNotice,
  KANBAN_COLUMNS,
  KanbanColumn,
  Locale,
  Notice,
  planMove,
} from '@palab/weaver-markdown';
import { addIssueComment, applyMove, fetchEvidence, fetchPull, type FetchFn } from '@palab/weaver-github';
import { attribution, PlannedAction } from './actions';
import type { CliCard } from './cards';

/** `in progress`, `In-Progress`, or `in_progress` all name the column "In progress". */
export function parseColumn(text: string | undefined): KanbanColumn | undefined {
  const wanted = (text ?? '').trim().toLowerCase().replace(/[-_]+/g, ' ');
  return KANBAN_COLUMNS.find((column) => column.toLowerCase() === wanted);
}

export type Planned<T = unknown> = { ok: true; actions: PlannedAction[]; note?: string } & T | { ok: false; refusal: Notice };

export interface MoveInput {
  token: string;
  card: CliCard;
  column: KanbanColumn;
  /** The task has a human-approved reason to accept it without complete evidence (DEC-006). */
  evidenceException: boolean;
  locale: Locale;
  fetchFn?: FetchFn;
}

/**
 * One action that makes the labels, the Issue state, and the board Status match the column, with
 * the same logic as the editor (`planMove`, `applyMove`). A move to Verified is refused when no
 * pull request is linked and the task has no evidence exception; other evidence gaps (no merged
 * pull request, failing checks) are shown in the plan for the person to weigh.
 */
export async function planCardMove(input: MoveInput): Promise<Planned> {
  const { card, column, locale } = input;
  const issue = { state: card.state, labels: card.labels };
  const plan = planMove(issue, column);
  if (plan.noop) return { ok: true, actions: [] };

  let warnings: string[] = [];
  if (column === 'Verified' && !input.evidenceException) {
    const read = await fetchEvidence(input.token, card.url, input.fetchFn);
    const gaps = evidenceGaps('Verified', read.ok ? read.evidence : undefined);
    const blocking = gaps.filter((gap) => gap.code === 'gap.no-linked-pr' || gap.code === 'gap.evidence-not-loaded');
    if (blocking.length) {
      return { ok: false, refusal: { code: 'cli.move-refused', args: { ref: `${card.repository}#${card.number}`, gaps: blocking.map((gap) => formatNotice(gap, locale)) } } };
    }
    warnings = gaps.map((gap) => formatNotice(gap, locale));
  }

  return { ok: true, actions: [moveAction(input.token, card, column, locale, input.fetchFn, warnings)] };
}

/** The action that applies `planMove` to a card; the editor runs the same `applyMove`. */
export function moveAction(
  token: string,
  card: Pick<CliCard, 'repository' | 'number' | 'url' | 'state' | 'labels'>,
  column: KanbanColumn,
  locale: Locale,
  fetchFn?: FetchFn,
  warnings: string[] = [],
  reason?: Notice,
): PlannedAction {
  const issue = { state: card.state, labels: card.labels };
  const plan = planMove(issue, column);
  const ref = `${card.repository}#${card.number}`;
  const changes = describeMove(plan, issue).map((line) => formatNotice(line, locale));
  return {
    kind: 'card.move',
    target: ref,
    summary: { code: 'cli.card-move.summary', args: { ref, column, changes: changes.join('; '), warnings: warnings.length ? ` (${warnings.join('; ')})` : '' } },
    reason: reason ?? { code: 'cli.card-move.reason', args: { column } },
    fingerprint: JSON.stringify(plan),
    run: async () => {
      const steps = await applyMove(token, card.url, plan, fetchFn);
      const failed = steps.find((step) => !step.ok);
      if (failed) {
        const detail = failed.detail ? formatNotice(failed.detail, 'en') : '';
        throw new Error(`${formatNotice(failed.name, 'en')} failed${detail ? `: ${detail}` : ''}. Steps done before: ${steps.filter((s) => s.ok).length}.`);
      }
    },
  };
}

export interface EvidenceInput {
  token: string;
  login: string | undefined;
  card: CliCard;
  /** A pull request number of the card's repository, or a pull request address. */
  pull: string;
  locale: Locale;
  fetchFn?: FetchFn;
}

/** `7`, `#7`, or `https://github.com/owner/name/pull/7`. */
export function parsePullRef(text: string, repository: string): { repository: string; number: number } | undefined {
  const wanted = text.trim();
  const plain = /^#?(\d+)$/.exec(wanted);
  if (plain) return { repository, number: Number(plain[1]) };
  const address = /^https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)\/?$/i.exec(wanted);
  return address ? { repository: address[1], number: Number(address[2]) } : undefined;
}

/**
 * One action that comments on the Issue with a link to a merged pull request, in the steward's
 * name. A pull request that was not merged is no evidence, so it is refused before anything is shown.
 */
export async function planEvidenceAttach(input: EvidenceInput): Promise<Planned> {
  const { card, locale } = input;
  const target = parsePullRef(input.pull, card.repository);
  if (!target) return { ok: false, refusal: { code: 'cli.bad-pull', args: { pull: input.pull } } };

  let pull;
  try {
    pull = await fetchPull(input.token, target.repository, target.number, input.fetchFn);
  } catch (error) {
    return { ok: false, refusal: { code: 'cli.pull-unreadable', args: { pull: input.pull, detail: (error as Error).message } } };
  }
  if (!pull.merged) return { ok: false, refusal: { code: 'cli.pull-not-merged', args: { pull: String(pull.number) } } };

  const ref = `${card.repository}#${card.number}`;
  const body = `${attribution(locale, input.login)}\n\nEvidence: pull request #${pull.number} (${pull.title}) was merged. ${pull.url}`;
  return {
    ok: true,
    actions: [
      {
        kind: 'evidence.attach',
        target: ref,
        summary: { code: 'cli.evidence.summary', args: { ref, pull: pull.number, title: pull.title } },
        reason: { code: 'cli.evidence.reason' },
        fingerprint: `${ref}|${pull.url}`,
        run: () => addIssueComment(input.token, card.repository, card.number, body, input.fetchFn),
      },
    ],
  };
}
