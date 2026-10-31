import { describe, expect, it } from 'vitest';
import { columnOfStatus, LIFECYCLE_STATUSES, loadWorkspace, offlineCards, parseFabric } from '../src';

const registry = (repos: string) => {
  const parsed = parseFabric('fabric.yaml', `project: {owner: o, number: 1}\nrepositories:\n${repos}`).registry;
  if (!parsed) throw new Error('bad registry');
  return parsed;
};

const req = (repo: string | undefined, tasks: string) =>
  `---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\n${repo ? `repository: ${repo}\n` : ''}---\n\n## Tasks\n\n${tasks}`;
const task = (id: string, extra: string) => `---\nid: ${id}\ntype: task\ntitle: ${id} title\nrequirement: REQ-001\n${extra}---\n`;
const cardsOf = (files: Record<string, string>, repos = '  - o/a\n') =>
  offlineCards(loadWorkspace(Object.entries(files).map(([path, text]) => ({ path, text }))).artifacts, registry(repos));

describe('columnOfStatus', () => {
  it('folds the lifecycle the way the product requirements do', () => {
    expect(columnOfStatus('draft')).toBe('Backlog');
    expect(columnOfStatus('ready')).toBe('Ready');
    expect(columnOfStatus('assigned')).toBe('Ready');
    expect(columnOfStatus('in-progress')).toBe('In progress');
    expect(columnOfStatus('blocked')).toBe('Blocked');
    expect(columnOfStatus('needs-human-decision')).toBe('Blocked');
    expect(columnOfStatus('review')).toBe('Review');
    expect(columnOfStatus('verified')).toBe('Verified');
    expect(columnOfStatus('accepted')).toBe('Verified');
  });

  it('shows a missing status in Backlog and gives a cancelled task no column', () => {
    expect(columnOfStatus(undefined)).toBe('Backlog');
    expect(columnOfStatus('cancelled')).toBeUndefined();
  });

  it('covers every lifecycle status', () => {
    for (const status of LIFECYCLE_STATUSES) expect(() => columnOfStatus(status)).not.toThrow();
  });
});

describe('offlineCards', () => {
  const link = '- `TASK-001` One — [GitHub Issue #5](https://github.com/o/a/issues/5)\n- `TASK-002` Two\n';

  it('builds a card for each task of a requirement of a registered repository', () => {
    const cards = cardsOf({ 'REQ-001.md': req('o/a', link), 'TASK-001.md': task('TASK-001', 'status: review\n') });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      repository: 'o/a',
      taskId: 'TASK-001',
      column: 'Review',
      issueNumber: 5,
      issueUrl: 'https://github.com/o/a/issues/5',
      statusUnknown: false,
      requirement: { id: 'REQ-001', path: 'REQ-001.md', taskId: 'TASK-001', taskPath: 'TASK-001.md' },
    });
  });

  it('puts a task with no status in Backlog and says that it does not know', () => {
    const cards = cardsOf({ 'REQ-001.md': req('o/a', link) });
    expect(cards.map((c) => [c.taskId, c.column, c.statusUnknown])).toEqual([
      ['TASK-001', 'Backlog', true],
      ['TASK-002', 'Backlog', true],
    ]);
    expect(cards[1]).not.toHaveProperty('issueNumber');
    expect(cards[1].requirement).not.toHaveProperty('taskPath');
  });

  it('uses the repository of the task file before the requirement, and the spelling of the registry', () => {
    const files = { 'REQ-001.md': req('o/a', '- `TASK-001` One\n'), 'TASK-001.md': task('TASK-001', 'status: draft\nrepository: O/B\n') };
    expect(cardsOf(files, '  - o/a\n  - o/b\n')[0].repository).toBe('o/b');
  });

  it('leaves out tasks of repositories that are not registered or have no repository, and cancelled tasks', () => {
    expect(cardsOf({ 'REQ-001.md': req('x/y', link) })).toEqual([]);
    expect(cardsOf({ 'REQ-001.md': req(undefined, link) })).toEqual([]);
    expect(cardsOf({ 'REQ-001.md': req('o/a', '- `TASK-001` One\n'), 'TASK-001.md': task('TASK-001', 'status: cancelled\n') })).toEqual([]);
  });
});
