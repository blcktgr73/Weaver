import { describe, expect, it } from 'vitest';
import { loadWorkspace, mergeTasks, ownerGaps, ownerOf, parseArtifact, RequirementArtifact, TaskArtifact } from '../src';

const REQ = `---
id: REQ-010
type: requirement
title: Sample
status: in-progress
---

## Acceptance criteria

- First
- Second

## Tasks

- \`TASK-010\` Do the thing — [GitHub Issue #10](https://github.com/owner/repo/issues/10)
- \`TASK-011\` No link yet
`;

const taskFile = (extra: string) => `---
id: TASK-010
type: task
title: Do the thing
requirement: REQ-010
${extra}
---
`;

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe('task files', () => {
  it('takes status from the Issue when the file has an Issue link', () => {
    const result = parseArtifact('t.md', taskFile('issue: https://github.com/owner/repo/issues/10'));
    expect(result.issues).toEqual([]);
    expect(result.artifact?.kind === 'task' && result.artifact.status).toBeFalsy();
  });

  it('still requires status without an Issue link', () => {
    const result = parseArtifact('t.md', taskFile(''));
    expect(codes(result.issues)).toEqual(['missing-field']);
  });

  it('keeps an explicit status and checks it', () => {
    const bad = parseArtifact('t.md', taskFile('issue: https://github.com/owner/repo/issues/10\nstatus: nope'));
    expect(codes(bad.issues)).toEqual(['invalid-status']);
  });

  it('reads the owner and criteria', () => {
    const result = parseArtifact(
      't.md',
      taskFile('issue: https://github.com/o/r/issues/10\nassignee_type: agent\nassignee: claude-code\ncriteria: [AC-001, AC-002]'),
    );
    const task = result.artifact as TaskArtifact;
    expect(task).toMatchObject({ assigneeType: 'agent', assignee: 'claude-code', criteria: ['AC-001', 'AC-002'] });
  });

  it('rejects malformed criteria', () => {
    const notList = parseArtifact('t.md', taskFile('status: draft\ncriteria: AC-001'));
    expect(codes(notList.issues)).toEqual(['criteria-not-list']);
    const badId = parseArtifact('t.md', taskFile('status: draft\ncriteria: [AC-1]'));
    expect(codes(badId.issues)).toEqual(['invalid-criterion']);
  });
});

describe('workspace rules for task files', () => {
  const files = (task: string) => [
    { path: 'req.md', text: REQ },
    { path: 'task.md', text: task },
  ];

  it('warns about a task file that the requirement does not list', () => {
    const task = taskFile('status: draft').replace('TASK-010', 'TASK-099');
    expect(codes(loadWorkspace(files(task)).issues.filter((i) => i.severity === 'warning'))).toContain('task-not-listed');
  });

  it('warns about a criterion the requirement does not have', () => {
    const issues = loadWorkspace(files(taskFile('status: draft\ncriteria: [AC-001, AC-009]'))).issues;
    const unknown = issues.filter((i) => i.code === 'unknown-criterion');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]).toMatchObject({ severity: 'warning', args: { criterion: 'AC-009' } });
  });

  it('accepts a listed task with known criteria', () => {
    const issues = loadWorkspace(files(taskFile('status: draft\ncriteria: [AC-002]'))).issues;
    expect(issues.map((i) => i.code)).toEqual(['task-without-issue']);
  });
});

describe('mergeTasks and owners', () => {
  const workspace = loadWorkspace([
    { path: 'req.md', text: REQ },
    { path: 'task.md', text: taskFile('status: draft\nassignee_type: human\nassignee: ada') },
  ]);
  const requirement = workspace.artifacts.find((a) => a.kind === 'requirement') as RequirementArtifact;

  it('joins by ID, keeps list order, and leaves other tasks alone', () => {
    const merged = mergeTasks(requirement, workspace.artifacts);
    expect(merged.map((t) => t.id)).toEqual(['TASK-010', 'TASK-011']);
    expect(merged[0].file?.assignee).toBe('ada');
    expect(merged[1].file).toBeUndefined();
  });

  it('prefers the recorded owner over the Issue assignee', () => {
    const [first, second] = mergeTasks(requirement, workspace.artifacts);
    expect(ownerOf(first, ['bot'])).toEqual({ name: 'ada', type: 'human', source: 'file' });
    expect(ownerOf(second, ['bot'])).toEqual({ name: 'bot', source: 'issue' });
    expect(ownerOf(second, [])).toBeUndefined();
  });

  it('asks for an owner once a task leaves the backlog', () => {
    expect(ownerGaps('Backlog', undefined)).toEqual([]);
    expect(ownerGaps('Ready', undefined)).toEqual([{ code: 'gap.no-owner' }]);
    expect(ownerGaps('Review', { name: 'ada', source: 'file' })).toEqual([]);
  });
});
