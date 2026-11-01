import { describe, expect, it } from 'vitest';
import { planAssignment, setFrontmatterFields } from '../src';

const human = { id: 'maria', kind: 'human' as const, github: 'maria-dev' };
const agent = { id: 'claude-code', kind: 'agent' as const };
const lines = (plan: ReturnType<typeof planAssignment>) => plan.changes.map((c) => `${c.code} ${JSON.stringify(c.args ?? {})}`);

describe('planAssignment: owner', () => {
  it('sets the owner and its kind in the file, and the Issue assignee for a human with a login', () => {
    const plan = planAssignment({ role: 'assignee', task: { assignee: 'old', assigneeType: 'agent' }, who: human, issueAssignees: ['old-login'], date: '2026-11-01' });
    expect(plan.fields).toEqual({ assignee: 'maria', assignee_type: 'human' });
    expect(plan.issueAssignees).toEqual(['maria-dev']);
    expect(lines(plan)).toEqual([
      'assign.change-file {"field":"assignee","from":"old","to":"maria"}',
      'assign.change-file {"field":"assignee_type","from":"agent","to":"human"}',
      'assign.change-issue {"from":"old-login","to":"maria-dev"}',
    ]);
  });

  it('leaves the Issue alone for an agent, and says so', () => {
    const plan = planAssignment({ role: 'assignee', task: {}, who: agent, date: '2026-11-01' });
    expect(plan.issueAssignees).toBeUndefined();
    expect(plan.fields).toEqual({ assignee: 'claude-code', assignee_type: 'agent' });
    expect(lines(plan).at(-1)).toBe('assign.issue-unchanged-agent {}');
  });

  it('leaves the Issue alone for a human without a GitHub login, and says so', () => {
    const plan = planAssignment({ role: 'assignee', task: {}, who: { id: 'lee', kind: 'human' }, date: '2026-11-01' });
    expect(plan.issueAssignees).toBeUndefined();
    expect(lines(plan).at(-1)).toBe('assign.issue-unchanged-no-login {}');
  });

  it('does not list what would not change, but still sets the fields', () => {
    const plan = planAssignment({ role: 'assignee', task: { assignee: 'maria', assigneeType: 'human' }, who: human, issueAssignees: ['Maria-Dev'], date: '2026-11-01' });
    expect(plan.changes).toEqual([]);
    expect(plan.fields).toEqual({ assignee: 'maria', assignee_type: 'human' });
    expect(plan.issueAssignees).toEqual(['maria-dev']);
  });

  it('shows an unread Issue as unknown', () => {
    const plan = planAssignment({ role: 'assignee', task: {}, who: human, date: '2026-11-01' });
    expect(lines(plan).at(-1)).toBe('assign.change-issue {"from":"?","to":"maria-dev"}');
  });

  it('quotes an id that is not plain YAML', () => {
    expect(planAssignment({ role: 'assignee', task: {}, who: { id: 'a: b', kind: 'human' }, date: '2026-11-01' }).fields.assignee).toBe('"a: b"');
  });
});

describe('planAssignment: reviewer and approval', () => {
  it('sets only the reviewer', () => {
    const plan = planAssignment({ role: 'reviewer', task: { reviewer: 'old' }, who: human, date: '2026-11-01' });
    expect(plan.fields).toEqual({ reviewer: 'maria' });
    expect(lines(plan)).toEqual(['assign.change-file {"field":"reviewer","from":"old","to":"maria"}']);
    expect(plan.issueAssignees).toBeUndefined();
  });

  it('records who approved and when, as a quoted date', () => {
    const plan = planAssignment({ role: 'approval', task: {}, who: human, date: '2026-11-01' });
    expect(plan.fields).toEqual({ approved_by: 'maria', approved_on: '"2026-11-01"' });
    expect(lines(plan)).toEqual([
      'assign.change-file {"field":"approved_by","from":"—","to":"maria"}',
      'assign.change-file {"field":"approved_on","from":"—","to":"2026-11-01"}',
    ]);
  });

  it('writes into a task file through setFrontmatterFields', () => {
    const plan = planAssignment({ role: 'approval', task: {}, who: human, date: '2026-11-01' });
    const text = '---\nid: TASK-001\nstatus: draft\n---\n\nBody\n';
    expect(setFrontmatterFields(text, plan.fields)).toBe('---\nid: TASK-001\nstatus: draft\napproved_by: maria\napproved_on: "2026-11-01"\n---\n\nBody\n');
  });
});
