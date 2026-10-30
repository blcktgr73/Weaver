import { describe, expect, it } from 'vitest';
import { acceptanceGaps, criteriaCoverage, loadWorkspace, mergeTasks, parseArtifact, recordAcceptance, RequirementArtifact } from '../src';

const REQ = `---
id: REQ-010
type: requirement
title: Sample
status: in-progress
owner: PALab
---

## Acceptance criteria

- First
- Second

## Tasks

- \`TASK-010\` Do the thing
- \`TASK-011\` Other thing
`;

const task = (id: string, extra: string) => `---
id: ${id}
type: task
title: T
requirement: REQ-010
status: draft
${extra}
---
`;

describe('acceptanceGaps', () => {
  const workspace = loadWorkspace([
    { path: 'req.md', text: REQ },
    { path: 'a.md', text: task('TASK-010', 'criteria: [AC-001]\nblockers: [waiting for the API]') },
    { path: 'b.md', text: task('TASK-011', 'criteria: [AC-002]').replace('status: draft', 'status: needs-human-decision') },
  ]);
  const requirement = workspace.artifacts.find((a) => a.kind === 'requirement') as RequirementArtifact;
  const tasks = mergeTasks(requirement, workspace.artifacts);
  const verified = () => ({ column: 'Verified' as const, evidenceGapCount: 0 });

  it('lists open criteria, blockers, and pending decisions', () => {
    const coverage = criteriaCoverage(requirement.criteria, tasks, () => ({ column: 'Review', evidenceGapCount: 0 }));
    expect(acceptanceGaps(coverage, tasks)).toEqual([
      'AC-001: in progress',
      'AC-002: in progress',
      'TASK-010 has blockers: waiting for the API',
      'TASK-011 waits for a human decision',
    ]);
  });

  it('speaks Korean when asked', () => {
    const coverage = criteriaCoverage(requirement.criteria, tasks, () => undefined);
    expect(acceptanceGaps(coverage, tasks, 'ko')[0]).toBe('AC-001: 상태를 읽지 않음');
  });

  it('is empty only when every criterion is verified and nothing blocks', () => {
    const clean = loadWorkspace([
      { path: 'req.md', text: REQ },
      { path: 'a.md', text: task('TASK-010', 'criteria: [AC-001, AC-002]') },
    ]);
    const req = clean.artifacts.find((a) => a.kind === 'requirement') as RequirementArtifact;
    const merged = mergeTasks(req, clean.artifacts);
    expect(acceptanceGaps(criteriaCoverage(req.criteria, merged, verified), merged)).toEqual([]);
  });
});

describe('recordAcceptance', () => {
  it('sets status and who/when, and leaves the rest alone', () => {
    const out = recordAcceptance(REQ, 'ada', '2026-10-30') as string;
    expect(out).toContain('status: accepted');
    expect(out).not.toContain('status: in-progress');
    expect(out).toContain('accepted_by: ada\naccepted_on: "2026-10-30"\n---');
    expect(out.slice(out.indexOf('## Acceptance criteria'))).toBe(REQ.slice(REQ.indexOf('## Acceptance criteria')));
    const parsed = parseArtifact('r.md', out);
    expect(parsed.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(parsed.artifact).toMatchObject({ status: 'accepted', acceptedBy: 'ada', acceptedOn: '2026-10-30', owner: 'PALab' });
  });

  it('replaces an earlier record instead of adding another', () => {
    const once = recordAcceptance(REQ, 'ada', '2026-10-29') as string;
    const twice = recordAcceptance(once, 'bob', '2026-10-30') as string;
    expect(twice.match(/accepted_by:/g)).toHaveLength(1);
    expect(twice).toContain('accepted_by: bob');
  });

  it('quotes a name that YAML would misread', () => {
    const out = recordAcceptance(REQ, 'Lee: Seung-Bum #1', '2026-10-30') as string;
    expect(parseArtifact('r.md', out).artifact).toMatchObject({ acceptedBy: 'Lee: Seung-Bum #1' });
  });

  it('keeps Windows line endings', () => {
    const crlf = REQ.replace(/\n/g, '\r\n');
    const out = recordAcceptance(crlf, 'ada', '2026-10-30') as string;
    expect(out).not.toMatch(/[^\r]\n/);
    expect(out).toContain('accepted_by: ada\r\n');
  });

  it('declines a file without frontmatter or a status line', () => {
    expect(recordAcceptance('# Just text', 'ada', '2026-10-30')).toBeUndefined();
    expect(recordAcceptance('---\nid: REQ-1\n---\n', 'ada', '2026-10-30')).toBeUndefined();
  });
});
