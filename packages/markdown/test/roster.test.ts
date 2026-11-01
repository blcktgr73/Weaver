import { describe, expect, it } from 'vitest';
import { findContributor, loadWorkspace, parseRoster, recordAcceptance, rosterGaps, setFrontmatterFields, yamlValue, type Roster } from '../src';

const yaml = (body: string) => `contributors:\n${body}`;
const ok = (text: string): Roster => {
  const result = parseRoster('roster.yaml', text);
  if (!result.roster) throw new Error(JSON.stringify(result.issues));
  return result.roster;
};
const codes = (text: string) => parseRoster('roster.yaml', text).issues.map((i) => `${i.severity}:${i.code}`);

describe('parseRoster', () => {
  it('reads people and agents with what is known about them', () => {
    const roster = ok(
      yaml(`  - id: blcktgr73\n    kind: human\n    github: blcktgr73\n  - id: claude-code\n    kind: agent\n    tool: Claude Code\n    model: opus\n    reach: the maintainer's VS Code session\n`),
    );
    expect(roster.contributors).toEqual([
      { id: 'blcktgr73', kind: 'human', github: 'blcktgr73' },
      { id: 'claude-code', kind: 'agent', tool: 'Claude Code', model: 'opus', reach: "the maintainer's VS Code session" },
    ]);
  });

  it('accepts an incomplete agent with a warning, because a roster is useful before it is complete', () => {
    const result = parseRoster('roster.yaml', yaml('  - id: helper\n    kind: agent\n'));
    expect(result.roster?.contributors).toHaveLength(1);
    expect(result.issues.map((i) => `${i.severity}:${i.code}:${i.args?.field}`)).toEqual(['warning:roster-agent-incomplete:tool', 'warning:roster-agent-incomplete:reach']);
  });

  it('reports what is wrong and gives no roster when there are errors', () => {
    expect(codes('not: [valid')).toEqual(['error:roster-invalid-yaml']);
    expect(codes('- a\n- b')).toEqual(['error:roster-not-a-mapping']);
    expect(codes('people: []')).toEqual(['warning:unknown-field', 'error:missing-field']);
    expect(codes('contributors: x')).toEqual(['error:roster-not-a-list']);
    expect(codes(yaml('  - just-a-string'))).toEqual(['error:roster-invalid-entry']);
    expect(codes(yaml('  - kind: human'))).toEqual(['error:missing-field']);
    expect(codes(yaml('  - id: a\n'))).toEqual(['error:missing-field']);
    expect(codes(yaml('  - id: a\n    kind: robot'))).toEqual(['error:roster-invalid-kind']);
    expect(codes(yaml('  - id: a/b\n    kind: human'))).toEqual(['error:roster-invalid-id']);
    expect(codes(yaml('  - id: a\n    kind: human\n  - id: A\n    kind: agent'))).toEqual(['error:roster-duplicate-id']);
    expect(codes('contributors: []')).toEqual(['error:roster-no-contributors']);
    expect(parseRoster('roster.yaml', 'contributors: x').roster).toBeUndefined();
  });

  it('warns about a field it does not know and keeps the roster', () => {
    const result = parseRoster('roster.yaml', yaml('  - id: a\n    kind: human\n    nickname: x\n'));
    expect(result.roster).toBeDefined();
    expect(result.issues.map((i) => i.args?.field)).toEqual(['roster.contributors.nickname']);
  });
});

describe('findContributor', () => {
  const roster = ok(yaml('  - id: Maria\n    kind: human\n    github: maria-dev\n  - id: bot\n    kind: agent\n    tool: t\n    reach: r\n'));
  it('finds by id or GitHub login without regard to case', () => {
    expect(findContributor(roster, 'maria')?.id).toBe('Maria');
    expect(findContributor(roster, 'MARIA-DEV')?.id).toBe('Maria');
    expect(findContributor(roster, 'nobody')).toBeUndefined();
    expect(findContributor(undefined, 'maria')).toBeUndefined();
    expect(findContributor(roster, undefined)).toBeUndefined();
  });
});

describe('rosterGaps', () => {
  const roster = ok(yaml('  - id: maria\n    kind: human\n  - id: bot\n    kind: agent\n    tool: t\n    reach: r\n'));
  const codesOf = (task: Parameters<typeof rosterGaps>[0], column: Parameters<typeof rosterGaps>[1]) => rosterGaps(task, column, roster).map((g) => g.code);

  it('sees nothing wrong when there is no roster', () => {
    expect(rosterGaps({ assignee: 'x', reviewer: 'y' }, 'Verified', undefined)).toEqual([]);
  });

  it('reports an owner, reviewer, or approver that is not in the roster', () => {
    expect(codesOf({ assignee: 'ghost' }, 'Ready')).toEqual(['gap.owner-not-in-roster']);
    expect(codesOf({ assignee: 'maria', reviewer: 'ghost' }, 'Ready')).toEqual(['gap.reviewer-not-in-roster']);
    expect(codesOf({ assignee: 'maria', approvedBy: 'ghost' }, 'Ready')).toEqual(['gap.approver-not-in-roster']);
  });

  it('reports an approver that is an agent', () => {
    expect(codesOf({ assignee: 'maria', approvedBy: 'bot' }, 'Ready')).toEqual(['gap.approver-not-human']);
  });

  it('wants a human approval of agent work once it is Verified, and only then', () => {
    expect(codesOf({ assignee: 'bot' }, 'Verified')).toEqual(['gap.no-human-approval']);
    expect(codesOf({ assignee: 'bot' }, 'Review')).toEqual([]);
    expect(codesOf({ assignee: 'bot', approvedBy: 'maria' }, 'Verified')).toEqual([]);
    expect(codesOf({ assignee: 'maria' }, 'Verified')).toEqual([]);
    // The task file's own type counts when the owner is not in the roster.
    expect(codesOf({ assignee: 'ghost', assigneeType: 'agent' }, 'Verified')).toEqual(['gap.owner-not-in-roster', 'gap.no-human-approval']);
  });
});

describe('task fields', () => {
  const file = (extra: string) => `---\nid: TASK-001\ntype: task\ntitle: T\nrequirement: REQ-001\nstatus: draft\n${extra}---\n`;
  const task = (extra: string) => {
    const artifacts = loadWorkspace([{ path: 'TASK-001.md', text: file(extra) }]).artifacts;
    const t = artifacts[0];
    if (t?.kind !== 'task') throw new Error('not a task');
    return t;
  };

  it('reads reviewer and approval', () => {
    const t = task('reviewer: maria\napproved_by: maria\napproved_on: "2026-11-01"\n');
    expect([t.reviewer, t.approvedBy, t.approvedOn]).toEqual(['maria', 'maria', '2026-11-01']);
  });

  it('reads an approval date that YAML turned into a date', () => {
    expect(task('approved_by: maria\napproved_on: 2026-11-01\n').approvedOn).toBe('2026-11-01');
  });

  it('does not call the new fields unknown', () => {
    const result = loadWorkspace([{ path: 'TASK-001.md', text: file('reviewer: a\napproved_by: b\napproved_on: "2026-11-01"\n') }]);
    expect(result.issues.filter((i) => i.code === 'unknown-field')).toEqual([]);
  });
});

describe('setFrontmatterFields', () => {
  it('replaces a field, adds a new one at the end, and removes one, leaving the rest alone', () => {
    const text = '---\nid: TASK-001\nassignee: old\nassignee_type: human\n---\n\n# Body\n';
    expect(setFrontmatterFields(text, { assignee: 'new', reviewer: 'maria', assignee_type: null })).toBe('---\nid: TASK-001\nassignee: new\nreviewer: maria\n---\n\n# Body\n');
  });

  it('keeps CRLF line endings and a byte order mark', () => {
    const text = '﻿---\r\nid: A\r\n---\r\nbody\r\n';
    expect(setFrontmatterFields(text, { reviewer: 'm' })).toBe('﻿---\r\nid: A\r\nreviewer: m\r\n---\r\nbody\r\n');
  });

  it('gives up on a file without frontmatter, and on a field written as a block', () => {
    expect(setFrontmatterFields('# no frontmatter\n', { a: 'b' })).toBeUndefined();
    expect(setFrontmatterFields('---\ncriteria:\n  - AC-001\n---\n', { criteria: '[AC-002]' })).toBeUndefined();
    // A block elsewhere does not matter when it is not the field to change.
    expect(setFrontmatterFields('---\ncriteria:\n  - AC-001\nassignee: a\n---\n', { assignee: 'b' })).toBe('---\ncriteria:\n  - AC-001\nassignee: b\n---\n');
  });

  it('quotes a value that is not plain YAML', () => {
    expect(yamlValue('maria')).toBe('maria');
    expect(yamlValue('Maria Lee')).toBe('Maria Lee');
    expect(yamlValue('a: b')).toBe('"a: b"');
    expect(yamlValue('2026-11-01')).toBe('2026-11-01');
  });

  it('is still what records acceptance, through the shared quoting', () => {
    const text = '---\nid: REQ-001\nstatus: in-progress\n---\n';
    expect(recordAcceptance(text, 'A: B', '2026-11-01')).toBe('---\nid: REQ-001\nstatus: accepted\naccepted_by: "A: B"\naccepted_on: "2026-11-01"\n---\n');
  });
});
