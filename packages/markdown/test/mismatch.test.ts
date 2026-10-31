import { describe, expect, it } from 'vitest';
import { findMismatches, loadWorkspace, placeIssue, taskIdsOfPull, type MergedPull, type MismatchCard } from '../src';

const REPO = 'o/a';
const url = (n: number) => `https://github.com/o/a/issues/${n}`;

const req = (tasks = '') =>
  `---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nrepository: ${REPO}\n---\n\n## Tasks\n\n${tasks}`;
const task = (id: string, extra = '') =>
  `---\nid: ${id}\ntype: task\ntitle: T\nrequirement: REQ-001\nstatus: draft\nrepository: ${REPO}\n${extra}---\n`;
const artifacts = (files: Record<string, string>) =>
  loadWorkspace(Object.entries(files).map(([path, text]) => ({ path, text }))).artifacts;

const card = (n: number, extra: Partial<MismatchCard> = {}): MismatchCard => ({
  repository: REPO,
  number: n,
  title: `Issue ${n}`,
  url: url(n),
  placement: placeIssue({ state: 'open', labels: ['status:backlog'] }),
  ...extra,
});

const kinds = (list: { kind: string }[]) => list.map((m) => m.kind);

describe('findMismatches', () => {
  it('is quiet when files, Issues, and the Project agree', () => {
    const files = artifacts({ 'REQ-001.md': req(), 'TASK-001.md': task('TASK-001', `issue: ${url(1)}\n`) });
    expect(findMismatches({ artifacts: files, cards: [card(1, { boardStatus: 'Todo' })], repositories: [REPO] })).toEqual([]);
  });

  it('reports a task file without an Issue', () => {
    const files = artifacts({ 'REQ-001.md': req(), 'TASK-001.md': task('TASK-001') });
    const found = findMismatches({ artifacts: files, cards: [], repositories: [REPO] });
    expect(found).toMatchObject([{ kind: 'task-without-issue', subject: 'TASK-001', path: 'TASK-001.md' }]);
  });

  it('reports an Issue link that is not an Issue URL', () => {
    const files = artifacts({ 'REQ-001.md': req(), 'TASK-001.md': task('TASK-001', 'issue: https://example.com/x\n') });
    expect(kinds(findMismatches({ artifacts: files, cards: [], repositories: [REPO] }))).toEqual(['broken-issue-link']);
  });

  it('reports a task whose Issue is in a registered repository but not on the Project', () => {
    const files = artifacts({ 'REQ-001.md': req(), 'TASK-001.md': task('TASK-001', `issue: ${url(9)}\n`) });
    const found = findMismatches({ artifacts: files, cards: [], repositories: [REPO] });
    expect(found).toMatchObject([{ kind: 'issue-not-on-project', subject: 'TASK-001', url: url(9) }]);
  });

  it('does not judge tasks of repositories that are not registered', () => {
    const files = artifacts({ 'REQ-001.md': req(), 'TASK-001.md': task('TASK-001').replace(REPO, 'x/y') });
    expect(findMismatches({ artifacts: files, cards: [], repositories: [REPO] })).toEqual([]);
  });

  it('reports a card without a task file only for a repository whose files are here', () => {
    const files = artifacts({ 'REQ-001.md': req() });
    const found = findMismatches({
      artifacts: files,
      cards: [card(1), card(2, { repository: 'o/elsewhere', url: 'https://github.com/o/elsewhere/issues/2' })],
      repositories: [REPO, 'o/elsewhere'],
    });
    expect(found).toMatchObject([{ kind: 'card-without-file', subject: '#1' }]);
  });

  it('counts a task listed under its requirement as a file', () => {
    const files = artifacts({ 'REQ-001.md': req(`- \`TASK-001\` T — [GitHub Issue #1](${url(1)})\n`) });
    expect(findMismatches({ artifacts: files, cards: [card(1)], repositories: [REPO] })).toEqual([]);
  });

  describe('board status', () => {
    const files = artifacts({ 'REQ-001.md': req(`- \`TASK-001\` T — [GitHub Issue #1](${url(1)})\n`) });
    const run = (c: MismatchCard) => findMismatches({ artifacts: files, cards: [c], repositories: [REPO] });

    it('reports a board Status that the label does not give', () => {
      expect(run(card(1, { boardStatus: 'In Progress' }))).toMatchObject([
        { kind: 'board-status-differs', args: { board: 'In Progress', expected: 'Todo', column: 'Backlog' } },
      ]);
    });

    it('folds columns the way DEC-003 does', () => {
      const review = card(1, { boardStatus: 'In Progress', placement: placeIssue({ state: 'open', labels: ['status:review'] }) });
      expect(run(review)).toEqual([]);
      const verified = card(1, { boardStatus: 'Done', placement: placeIssue({ state: 'closed', labels: ['status:verified'] }) });
      expect(run(verified)).toEqual([]);
    });

    it('stays quiet when the label rules already report the card, and when the card has no board Status', () => {
      const gap = card(1, { boardStatus: 'Done', placement: placeIssue({ state: 'closed', labels: ['status:backlog'] }) });
      expect(run(gap)).toEqual([]);
      expect(run(card(1))).toEqual([]);
    });
  });

  describe('merged pull requests', () => {
    const files = artifacts({ 'REQ-001.md': req(), 'TASK-033.md': task('TASK-033', `issue: ${url(65)}\n`) });
    const cards = [card(65, { taskId: 'TASK-033' })];
    const pull = (extra: Partial<MergedPull>): MergedPull => ({
      repository: REPO, number: 80, title: 'feat: card (TASK-033)', url: 'https://github.com/o/a/pull/80', branch: 'feat/task-033-x', closes: [], ...extra,
    });
    const run = (pulls: MergedPull[], list = files) => findMismatches({ artifacts: list, cards, repositories: [REPO], pulls });

    it('reports a merged pull request that names the task but does not close its Issue', () => {
      expect(run([pull({})])).toMatchObject([{ kind: 'merged-pr-not-linked', args: { pull: 80, task: 'TASK-033', number: 65 }, url: 'https://github.com/o/a/pull/80' }]);
    });

    it('is quiet when the pull request closes the Issue', () => {
      expect(run([pull({ closes: [65] })])).toEqual([]);
    });

    it('is quiet for a task with an evidence exception', () => {
      const withException = artifacts({ 'REQ-001.md': req(), 'TASK-033.md': task('TASK-033', `issue: ${url(65)}\nevidence_exception: before the rule\n`) });
      expect(run([pull({})], withException)).toEqual([]);
    });

    it('ignores a docs pull request, which writes a task rather than implementing it', () => {
      expect(run([pull({ title: 'docs: add lanes (TASK-033)', branch: 'docs/lanes' })])).toEqual([]);
      expect(run([pull({ title: 'Docs(core): add lanes (TASK-033)', branch: 'docs/lanes' })])).toEqual([]);
      expect(run([pull({ title: 'documentation fix (TASK-033)', branch: 'x/y' })])).toHaveLength(1);
    });

    it('ignores a pull request of another repository or for a task with no card', () => {
      expect(run([pull({ repository: 'o/other' })])).toEqual([]);
      expect(run([pull({ title: 'feat: x (TASK-099)', branch: 'feat/y' })])).toEqual([]);
    });
  });
});

describe('taskIdsOfPull', () => {
  it('reads the branch and a trailing parenthesized ID', () => {
    expect(taskIdsOfPull({ title: 'feat: a (TASK-033)', branch: 'feat/task-033-card' })).toEqual(['TASK-033']);
    expect(taskIdsOfPull({ title: 'fix: b (TASK-001, TASK-002)', branch: 'fix/b' })).toEqual(['TASK-001', 'TASK-002']);
    expect(taskIdsOfPull({ title: 'x', branch: 'feat/TASK-12-nope' })).toEqual([]);
  });

  it('does not take a task ID that is only mentioned in the title', () => {
    expect(taskIdsOfPull({ title: 'docs: add TASK-040 and TASK-041 to REQ-006', branch: 'docs/req-006-board-summary' })).toEqual([]);
  });
});
