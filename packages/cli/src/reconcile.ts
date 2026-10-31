import {
  Artifact,
  findMismatches,
  formatNotice,
  Locale,
  MergedPull,
  MessageKey,
  normalizeIssueUrl,
  planMove,
  Mismatch,
} from '@palab/weaver-markdown';
import { addIssueComment, hasIssueComment, setBoardStatus, type Fetch, type FetchFn, type ProjectCard } from '@palab/weaver-github';
import { attribution, PlannedAction, ReportItem } from './actions';
import { cardNotices } from './cards';
import { moveAction } from './cardActions';
import { planProjectAdd } from './projectAdd';

/** How far along the board Status values are, so "behind" and "ahead" can be told apart. */
const BOARD_RANK: Record<string, number> = { Todo: 0, 'In Progress': 1, Done: 2 };

export interface ReconcileInput {
  token: string;
  login: string | undefined;
  locale: Locale;
  project: { owner: string; number: number };
  repositories: readonly string[];
  cards: readonly ProjectCard[];
  artifacts: readonly Artifact[];
  pulls: readonly MergedPull[];
  now: Date;
  fetch?: Fetch;
  fetchFn?: FetchFn;
}

export interface ReconcilePlan {
  actions: PlannedAction[];
  reports: ReportItem[];
}

/**
 * Turns what REQ-006 reports into the three tiers of REQ-007 (the rule table is in DEC-012):
 * - an *automatic* fix is a fact that is easy to undo (an Issue added to the Project);
 * - a *proposed* fix changes a card's meaning or leaves a note, and is shown for approval (a board Status
 *   that is behind its label is brought up to it; one that is ahead is reported);
 * - everything else is *reported* for a person.
 * Every action still goes through the one-at-a-time confirmation of DEC-008. Nothing here closes an
 * Issue, commits to a default branch, or marks work verified on its own.
 */
export async function planReconcile(input: ReconcileInput): Promise<ReconcilePlan> {
  const { locale } = input;
  const actions: PlannedAction[] = [];
  const reports: ReportItem[] = [];
  const message = (m: Mismatch): string => formatNotice({ code: `mismatch.${m.kind}` as MessageKey, args: m.args }, locale);
  const byUrl = new Map(input.cards.map((card) => [normalizeIssueUrl(card.url), card]));
  const onProject = input.cards.map((card) => card.url);

  for (const m of findMismatches({ artifacts: input.artifacts, cards: input.cards, repositories: input.repositories, pulls: input.pulls })) {
    const item = (tier: ReportItem['tier'], automated: boolean): ReportItem => ({
      tier,
      kind: m.kind,
      subject: m.subject,
      message: message(m),
      automated,
      ...(m.path ? { path: m.path } : {}),
      ...(m.url ? { url: m.url } : {}),
    });

    switch (m.kind) {
      case 'issue-not-on-project': {
        const plan = planProjectAdd([m.url ?? ''], { token: input.token, project: input.project, repositories: input.repositories, onProject, fetch: input.fetch });
        actions.push(...plan.actions);
        break;
      }
      case 'board-status-differs': {
        const card = byUrl.get(normalizeIssueUrl(m.url ?? ''));
        const expected = String(m.args.expected ?? '');
        if (!card || !expected) break;
        // A board that is ahead of the label was moved by a person (or the board's own rules) first.
        // Moving it back would undo real progress, and making the label follow could close the Issue,
        // so that case is only reported.
        if ((BOARD_RANK[String(m.args.board ?? '')] ?? 0) > (BOARD_RANK[expected] ?? 0)) {
          reports.push(item('report', false));
          break;
        }
        const ref = `${card.repository}#${card.number}`;
        actions.push({
          kind: 'board.status',
          target: ref,
          summary: { code: 'cli.reconcile.board-status', args: { ref, board: String(m.args.board ?? ''), status: expected, column: String(m.args.column ?? '') } },
          reason: { code: 'cli.reconcile.board-status-reason' },
          fingerprint: `${ref}|${expected}`,
          run: async () => void (await setBoardStatus(input.token, card.url, expected, input.fetchFn)),
        });
        break;
      }
      case 'merged-pr-not-linked': {
        const pull = input.pulls.find((p) => p.url === m.url);
        const number = Number(m.args.number);
        const card = pull && input.cards.find((c) => c.repository.toLowerCase() === pull.repository.toLowerCase() && c.number === number);
        if (!pull || !card) break;
        const marker = `<!-- weaver:pull-${pull.number} -->`;
        let already: boolean;
        try {
          already = await hasIssueComment(input.token, card.repository, card.number, marker, input.fetchFn);
        } catch {
          reports.push(item('proposed', false));
          break;
        }
        if (already) break;
        const ref = `${card.repository}#${card.number}`;
        actions.push({
          kind: 'issue.comment',
          target: ref,
          summary: { code: 'cli.reconcile.comment', args: { ref, pull: pull.number, task: String(m.args.task ?? '') } },
          reason: { code: 'cli.reconcile.comment-reason' },
          fingerprint: `${ref}|${pull.url}`,
          run: () =>
            addIssueComment(
              input.token,
              card.repository,
              card.number,
              `${attribution(locale, input.login)}\n\nPull request #${pull.number} (${pull.title}) names ${m.args.task} but does not close this Issue. Closing it stays with a person.\n${marker}`,
              input.fetchFn,
            ),
        });
        break;
      }
      case 'task-without-issue':
      case 'card-without-file':
        // Proposed in DEC-012, but they need a file change as a pull request, which is not automated yet.
        reports.push(item('proposed', false));
        break;
      case 'broken-issue-link':
        reports.push(item('report', false));
        break;
    }
  }

  // A closed task Issue keeps its old status label when a pull request closes it (DEC-003: closed means Verified).
  for (const card of input.cards) {
    const isTask = card.taskId !== undefined || card.labels.includes('task');
    if (card.state === 'closed' && isTask && !planMove(card, 'Verified').noop) {
      actions.push(moveAction(input.token, card, 'Verified', locale, input.fetchFn, [], { code: 'cli.reconcile.relabel-reason' }));
    }
  }

  // Stale cards need a person's judgment.
  const notices = cardNotices(input.cards, input.artifacts, input.now);
  for (const card of input.cards) {
    for (const notice of notices.get(normalizeIssueUrl(card.url)) ?? []) {
      reports.push({
        tier: 'report',
        kind: notice.code,
        subject: `${card.repository}#${card.number}`,
        message: formatNotice(notice, locale),
        automated: false,
        url: card.url,
      });
    }
  }

  return { actions, reports };
}
