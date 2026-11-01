import {
  Artifact,
  DEFAULT_STALE_DAYS,
  EvidenceRules,
  honoredException,
  Notice,
  normalizeIssueUrl,
  RequirementLink,
  requirementsByIssue,
  staleNotices,
} from '@palab/weaver-markdown';
import type { ProjectCard } from '@palab/weaver-github';

/** One card as the tool prints it. Part of the JSON contract; add fields, do not rename them. */
export interface CliCard {
  repository: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  column: string;
  labels: string[];
  assignees: string[];
  updatedAt?: string;
  /** The board `Status`, when the card has one. */
  boardStatus?: string;
  task?: { id: string; path?: string };
  requirement?: { id: string; title: string; path: string };
  /** Why the card needs a second look: `idle`, `no-evidence`, `needs-decision`. */
  stale: string[];
  /** Why the column is uncertain, as catalog codes. */
  gaps: string[];
}

/** The stale notices of each card, by normalized Issue address. */
/** Days of no change before a card is idle: one number for all, or one per repository (DEC-015). */
export type IdleDays = number | ((repository: string) => number);

export function cardNotices(
  cards: readonly ProjectCard[],
  artifacts: readonly Artifact[],
  now: Date,
  idleDays: IdleDays = DEFAULT_STALE_DAYS,
  evidenceFor?: (repository: string) => EvidenceRules | undefined,
): Map<string, Notice[]> {
  const links = requirementsByIssue(artifacts);
  const tasks = new Map(artifacts.flatMap((a) => (a.kind === 'task' ? [[a.path, a] as const] : [])));
  return new Map(
    cards.map((card) => {
      const link = links.get(normalizeIssueUrl(card.url));
      const task = link?.taskPath ? tasks.get(link.taskPath) : undefined;
      const evidence = evidenceFor?.(card.repository);
      const notices = staleNotices(
        {
          column: card.placement.column,
          state: card.state,
          updatedAt: card.updatedAt,
          pullCount: card.pullCount,
          needsDecision: task?.status === 'needs-human-decision',
          evidenceException: Boolean(honoredException(task?.evidenceException, evidence)),
          pullRequest: evidence?.pullRequest,
        },
        now,
        typeof idleDays === 'function' ? idleDays(card.repository) : idleDays,
      );
      return [normalizeIssueUrl(card.url), notices] as const;
    }),
  );
}

export function toCliCards(
  cards: readonly ProjectCard[],
  artifacts: readonly Artifact[],
  now: Date,
  idleDays: IdleDays = DEFAULT_STALE_DAYS,
  evidenceFor?: (repository: string) => EvidenceRules | undefined,
): CliCard[] {
  const links = requirementsByIssue(artifacts);
  const notices = cardNotices(cards, artifacts, now, idleDays, evidenceFor);
  return cards.map((card) => {
    const link: RequirementLink | undefined = links.get(normalizeIssueUrl(card.url));
    const taskId = link?.taskId ?? card.taskId;
    const stale = (notices.get(normalizeIssueUrl(card.url)) ?? []).map((notice) => notice.code.slice('stale.'.length));
    return {
      repository: card.repository,
      number: card.number,
      title: card.title,
      url: card.url,
      state: card.state,
      column: card.placement.column,
      labels: card.labels,
      assignees: card.assignees,
      ...(card.updatedAt ? { updatedAt: card.updatedAt } : {}),
      ...(card.boardStatus ? { boardStatus: card.boardStatus } : {}),
      ...(taskId ? { task: { id: taskId, ...(link?.taskPath ? { path: link.taskPath } : {}) } } : {}),
      ...(link ? { requirement: { id: link.id, title: link.title, path: link.path } } : {}),
      stale,
      gaps: card.placement.gaps.map((gap) => gap.code),
    };
  });
}

/** A card named by `owner/name#number`, an Issue address, or `TASK-###`. */
export function findCards(cards: readonly CliCard[], ref: string): CliCard[] {
  const wanted = ref.trim();
  const short = /^([^/\s]+\/[^#\s]+)#(\d+)$/.exec(wanted);
  if (short) return cards.filter((c) => c.repository.toLowerCase() === short[1].toLowerCase() && c.number === Number(short[2]));
  if (/^TASK-\d{3,}$/i.test(wanted)) return cards.filter((c) => c.task?.id.toLowerCase() === wanted.toLowerCase());
  return cards.filter((c) => normalizeIssueUrl(c.url) === normalizeIssueUrl(wanted));
}
