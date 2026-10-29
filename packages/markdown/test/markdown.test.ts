import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadWorkspace, parseArtifact } from '../src';

const REQ = `---
id: REQ-010
type: requirement
title: Sample
status: in-progress
story_ids: [US-001]
repository: owner/repo
---

# Sample

## Acceptance criteria

- First criterion
- [ ] Second criterion

## Tasks

- \`TASK-010\` Do the thing — [GitHub Issue #10](https://github.com/owner/repo/issues/10)
- \`TASK-011\` No link yet
`;

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

describe('parseArtifact', () => {
  it('ignores ordinary Markdown', () => {
    expect(parseArtifact('a.md', '# Hello').isArtifact).toBe(false);
    expect(parseArtifact('a.md', '---\ntitle: x\n---\nbody').isArtifact).toBe(false);
  });

  it('parses a valid requirement', () => {
    const result = parseArtifact('req.md', REQ);
    expect(result.isArtifact).toBe(true);
    const artifact = result.artifact;
    expect(artifact?.kind).toBe('requirement');
    if (artifact?.kind !== 'requirement') throw new Error('unreachable');
    expect(artifact.criteria).toEqual([
      { id: 'AC-001', text: 'First criterion' },
      { id: 'AC-002', text: 'Second criterion' },
    ]);
    expect(artifact.tasks[0]).toMatchObject({ id: 'TASK-010', title: 'Do the thing', issueNumber: 10 });
    expect(artifact.tasks[1].issueUrl).toBeUndefined();
    expect(codes(result.issues)).toEqual(['task-without-issue']);
  });

  it('reports missing fields and bad values as errors', () => {
    const text = '---\nid: REQ-1\ntype: requirement\nstatus: in_progress\nrepository: nope\n---\n';
    const result = parseArtifact('bad.md', text);
    expect(result.artifact).toBeUndefined();
    expect(codes(result.issues.filter((i) => i.severity === 'error'))).toEqual([
      'invalid-id',
      'invalid-repository',
      'invalid-status',
      'missing-field',
    ]);
  });

  it('rejects an ID whose prefix does not match the type', () => {
    const text = '---\nid: TASK-001\ntype: requirement\ntitle: x\nstatus: draft\n---\n';
    expect(codes(parseArtifact('x.md', text).issues)).toContain('invalid-id');
  });

  it('flags invalid YAML only for artifacts', () => {
    expect(parseArtifact('a.md', '---\ntype: task\ntitle: [oops\n---\n').issues[0].code).toBe('frontmatter-invalid');
    expect(parseArtifact('a.md', '---\ntitle: [oops\n---\n').isArtifact).toBe(false);
  });

  it('keeps unknown fields as warnings', () => {
    const text = REQ.replace('type: requirement', 'type: requirement\nextra: 1');
    expect(codes(parseArtifact('r.md', text).issues)).toContain('unknown-field');
  });

  it('warns about missing sections and malformed task items', () => {
    const text = '---\nid: REQ-002\ntype: requirement\ntitle: T\nstatus: draft\n---\n## Tasks\n\n- not a task id\n';
    expect(codes(parseArtifact('r.md', text).issues)).toEqual([
      'malformed-task-item',
      'no-acceptance-criteria',
      'no-tasks',
    ]);
  });

  it('handles CRLF line endings', () => {
    const result = parseArtifact('r.md', REQ.replace(/\n/g, '\r\n'));
    expect(result.artifact?.kind).toBe('requirement');
  });

  it('parses a task artifact', () => {
    const text = [
      '---', 'id: TASK-001', 'type: task', 'requirement: REQ-010', 'title: T', 'status: review',
      'assignee_type: agent', 'assignee: codex', 'pull_request: null', 'blockers: []', '---',
    ].join('\n');
    const artifact = parseArtifact('t.md', text).artifact;
    expect(artifact).toMatchObject({ kind: 'task', assigneeType: 'agent', pullRequest: null, blockers: [] });
  });

  it('rejects an unknown assignee type', () => {
    const text = '---\nid: TASK-001\ntype: task\nrequirement: REQ-010\ntitle: T\nstatus: draft\nassignee_type: robot\n---\n';
    expect(codes(parseArtifact('t.md', text).issues)).toContain('invalid-assignee-type');
  });
});

describe('loadWorkspace', () => {
  const task = (id: string, req: string) =>
    `---\nid: ${id}\ntype: task\nrequirement: ${req}\ntitle: T\nstatus: draft\n---\n`;

  it('accepts consistent artifacts', () => {
    const { issues } = loadWorkspace([
      { path: 'r.md', text: REQ },
      { path: 't.md', text: task('TASK-020', 'REQ-010') },
    ]);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('detects duplicate IDs and unknown requirements', () => {
    const { issues } = loadWorkspace([
      { path: 'r.md', text: REQ },
      { path: 'r2.md', text: REQ },
      { path: 't.md', text: task('TASK-020', 'REQ-999') },
    ]);
    expect(codes(issues.filter((i) => i.severity === 'error'))).toEqual([
      'duplicate-id',
      'unknown-requirement',
    ]);
  });

  it('detects a task listed under two requirements', () => {
    const other = REQ.replace('REQ-010', 'REQ-011');
    const { issues } = loadWorkspace([
      { path: 'r.md', text: REQ },
      { path: 'r2.md', text: other },
    ]);
    expect(codes(issues.filter((i) => i.severity === 'error'))).toEqual(['task-listed-twice', 'task-listed-twice']);
  });
});

describe('this repository', () => {
  const root = resolve(__dirname, '../../..');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : full.endsWith('.md') ? [full] : [];
    });

  it('REQ-001 and all docs pass validation without errors', () => {
    const files = walk(join(root, 'docs')).map((file) => ({
      path: relative(root, file).replace(/\\/g, '/'),
      text: readFileSync(file, 'utf8'),
    }));
    const { artifacts, issues } = loadWorkspace(files);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    const req = artifacts.find((a) => a.id === 'REQ-001');
    expect(req?.kind).toBe('requirement');
    if (req?.kind !== 'requirement') throw new Error('unreachable');
    expect(req.criteria).toHaveLength(6);
    expect(req.tasks.map((t) => t.id)).toEqual(['TASK-001', 'TASK-002', 'TASK-003', 'TASK-004', 'TASK-005']);
  });
});
