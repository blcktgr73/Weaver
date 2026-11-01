import type { MessageArgs } from './i18n';
import type { KanbanColumn, KanbanPlacement } from './kanban';
import { normalizeIssueUrl, requirementsByIssue } from './overview';
import type { Artifact } from './types';

export type MismatchKind =
  | 'task-without-issue'
  | 'broken-issue-link'
  | 'issue-not-on-project'
  | 'card-without-file'
  | 'merged-pr-not-linked'
  | 'board-status-differs';

/** One place where the repository files, the Issues, and the central Project do not agree. */
export interface Mismatch {
  kind: MismatchKind;
  /** The task, card, or pull request the mismatch is about, for ordering and display. */
  subject: string;
  /** Message arguments; the catalog key is `mismatch.<kind>`. */
  args: MessageArgs;
  /** Workspace-relative path of the file to open, when the mismatch is in a file. */
  path?: string;
  /** A GitHub page to open. */
  url?: string;
}

export interface MismatchCard {
  repository: string;
  number: number;
  title: string;
  url: string;
  taskId?: string;
  boardStatus?: string;
  /** A closed Issue has nothing left to close, so a pull request that did not close it is not a mismatch. */
  state?: 'open' | 'closed';
  placement: KanbanPlacement;
}

export interface MergedPull {
  repository: string;
  number: number;
  title: string;
  url: string;
  branch: string;
  /** Issue numbers the pull request closes, as GitHub records them. */
  closes: number[];
}

/** The board Status each column folds into (DEC-003). */
const BOARD_STATUS: Record<KanbanColumn, string> = {
  Backlog: 'Todo',
  Ready: 'Todo',
  'In progress': 'In Progress',
  Blocked: 'In Progress',
  Review: 'In Progress',
  Verified: 'Done',
};

export function expectedBoardStatus(column: KanbanColumn): string {
  return BOARD_STATUS[column];
}

const ISSUE_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/i;

/**
 * Task IDs a pull request names: in its branch (`feat/task-033-...`) or in a trailing
 * `(TASK-033)` of its title. A task ID elsewhere in the title is only a mention.
 */
export function taskIdsOfPull(pull: Pick<MergedPull, 'title' | 'branch'>): string[] {
  const ids = new Set<string>();
  for (const match of pull.branch.matchAll(/(?:^|[\/_-])task-(\d{3,})(?=$|[\/_-])/gi)) ids.add(`TASK-${match[1]}`);
  const trailing = /\(((?:TASK-\d{3,})(?:\s*,\s*TASK-\d{3,})*)\)\s*$/.exec(pull.title);
  if (trailing) for (const id of trailing[1].match(/TASK-\d{3,}/g) ?? []) ids.add(id);
  return [...ids];
}

export interface MismatchInput {
  artifacts: readonly Artifact[];
  cards: readonly MismatchCard[];
  /** The registered repositories, `owner/name`. */
  repositories: readonly string[];
  /** Recently merged pull requests of the registered repositories; leave empty when they were not read. */
  pulls?: readonly MergedPull[];
  /** Repositories whose process takes the column from the board Status (DEC-015); the board cannot differ from itself. */
  boardSourced?: readonly string[];
  /** Repositories whose process does not honor an `evidence_exception` (DEC-015). */
  exceptionsIgnored?: readonly string[];
  /** Repositories whose process does not need a pull request that closes the Issue (DEC-015). */
  closingNotRequired?: readonly string[];
}

/**
 * Finds where files, Issues, and the Project disagree. It only reports: nothing is changed.
 * A Project card can only be judged against files for repositories whose files are in the
 * workspace, so cards of other repositories are not reported as missing a file.
 */
export function findMismatches(input: MismatchInput): Mismatch[] {
  const { artifacts, cards, repositories } = input;
  const registered = new Set(repositories.map((name) => name.toLowerCase()));
  const boardSourced = new Set((input.boardSourced ?? []).map((name) => name.toLowerCase()));
  const exceptionsIgnored = new Set((input.exceptionsIgnored ?? []).map((name) => name.toLowerCase()));
  const closingNotRequired = new Set((input.closingNotRequired ?? []).map((name) => name.toLowerCase()));
  const found: Mismatch[] = [];
  const cardByUrl = new Map(cards.map((card) => [normalizeIssueUrl(card.url), card]));
  const links = requirementsByIssue(artifacts);

  // Repositories whose files are here: named by a requirement or task file's `repository`.
  const seen = new Set<string>();
  for (const artifact of artifacts) if (artifact.repository) seen.add(artifact.repository.toLowerCase());

  for (const artifact of artifacts) {
    if (artifact.kind !== 'task') continue;
    const repository = artifact.repository?.toLowerCase();
    if (repository && !registered.has(repository)) continue;
    if (!artifact.issue) {
      found.push({ kind: 'task-without-issue', subject: artifact.id, args: { task: artifact.id }, path: artifact.path });
    } else if (!ISSUE_URL.test(artifact.issue.trim())) {
      found.push({ kind: 'broken-issue-link', subject: artifact.id, args: { task: artifact.id, issue: artifact.issue }, path: artifact.path });
    } else if (!cardByUrl.has(normalizeIssueUrl(artifact.issue))) {
      const where = /github\.com\/([\w.-]+\/[\w.-]+)\//i.exec(artifact.issue)?.[1].toLowerCase();
      if (where && registered.has(where)) {
        found.push({ kind: 'issue-not-on-project', subject: artifact.id, args: { task: artifact.id, issue: artifact.issue }, path: artifact.path, url: artifact.issue });
      }
    }
  }

  for (const card of cards) {
    const repository = card.repository.toLowerCase();
    const label = `#${card.number}`;
    if (seen.has(repository) && !links.has(normalizeIssueUrl(card.url))) {
      found.push({ kind: 'card-without-file', subject: label, args: { number: card.number, repository: card.repository, title: card.title }, url: card.url });
    }
    // The label rules already report an inconsistent card; compare the board only when they are quiet.
    const expected = expectedBoardStatus(card.placement.column);
    if (card.boardStatus && !boardSourced.has(repository) && card.placement.gaps.length === 0 && card.boardStatus !== expected) {
      found.push({
        kind: 'board-status-differs',
        subject: label,
        args: { number: card.number, repository: card.repository, board: card.boardStatus, expected, column: card.placement.column },
        url: card.url,
      });
    }
  }

  const exceptions = new Set<string>();
  for (const artifact of artifacts) {
    if (artifact.kind === 'task' && artifact.evidenceException && !exceptionsIgnored.has((artifact.repository ?? '').toLowerCase())) exceptions.add(artifact.id);
  }
  for (const pull of input.pulls ?? []) {
    // A `docs:` pull request usually writes or splits a task; it is not what implements it.
    if (/^docs(\([^)]*\))?!?:/i.test(pull.title.trim())) continue;
    for (const taskId of taskIdsOfPull(pull)) {
      if (exceptions.has(taskId)) continue;
      const card = cards.find((c) => c.taskId === taskId && c.repository.toLowerCase() === pull.repository.toLowerCase());
      if (card && card.state !== 'closed' && !pull.closes.includes(card.number) && !closingNotRequired.has(pull.repository.toLowerCase())) {
        found.push({
          kind: 'merged-pr-not-linked',
          subject: taskId,
          args: { pull: pull.number, task: taskId, number: card.number },
          url: pull.url,
        });
      }
    }
  }

  return found;
}
