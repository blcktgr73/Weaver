import { describe, expect, it } from 'vitest';
import { DEFAULT_PROCESS, DEFAULT_STALE_DAYS, defaultProcess, KANBAN_COLUMNS, LABEL_FOR_COLUMN, placeIssue, parseProcess } from '../src';

const parse = (text: string) => parseProcess('.weaver/process.yaml', text);
const codes = (text: string) => parse(text).issues.map((i) => `${i.severity}:${i.code}`);

describe('the defaults are today\'s behavior', () => {
  it('uses the labels and the idle limit that the code uses', () => {
    expect(DEFAULT_PROCESS.columns.source).toBe('labels');
    expect(DEFAULT_PROCESS.columns.labels).toEqual(LABEL_FOR_COLUMN);
    expect(DEFAULT_PROCESS.stale.idleDays).toBe(DEFAULT_STALE_DAYS);
    expect(DEFAULT_PROCESS.evidence).toEqual({ pullRequest: 'required', closingPullRequest: true, exceptions: true });
  });

  it('has a label for each of the six columns, and a board map onto them', () => {
    expect(Object.keys(DEFAULT_PROCESS.columns.labels)).toEqual([...KANBAN_COLUMNS]);
    for (const [column, label] of Object.entries(DEFAULT_PROCESS.columns.labels)) {
      expect(placeIssue({ state: column === 'Verified' ? 'closed' : 'open', labels: [label] })).toEqual({ column, gaps: [] });
    }
    expect(DEFAULT_PROCESS.columns.board).toEqual({ Todo: 'Backlog', 'In Progress': 'In progress', Done: 'Verified' });
  });

  it('gives a fresh copy each time, so nothing can change the defaults', () => {
    const copy = defaultProcess();
    copy.columns.labels.Backlog = 'changed';
    copy.columns.board.Extra = 'Ready';
    expect(defaultProcess().columns.labels.Backlog).toBe('status:backlog');
    expect(defaultProcess().columns.board.Extra).toBeUndefined();
    expect(DEFAULT_PROCESS.columns.labels.Backlog).toBe('status:backlog');
  });
});

describe('parseProcess: a file that holds nothing, or something partial', () => {
  it('means all defaults for no file content, an empty file, or only a version', () => {
    for (const text of ['', '   \n', 'version: 1\n', '# only a comment\n']) {
      const result = parse(text);
      expect(result.process).toEqual(defaultProcess());
      expect(result.sources).toEqual({ columns: 'default', evidence: 'default', stale: 'default' });
      expect(result.issues).toEqual([]);
    }
  });

  it('applies the sections that are there and leaves the others as defaults', () => {
    const result = parse('version: 1\ncolumns:\n  source: board-status\n');
    expect(result.process.columns.source).toBe('board-status');
    expect(result.process.evidence).toEqual(defaultProcess().evidence);
    expect(result.sources).toEqual({ columns: 'repository', evidence: 'default', stale: 'default' });
    expect(result.issues).toEqual([]);
  });

  it('keeps the default of a field that is left out inside a section', () => {
    const result = parse('evidence:\n  pull-request: optional\n');
    expect(result.process.evidence).toEqual({ pullRequest: 'optional', closingPullRequest: true, exceptions: true });
    expect(result.sources.evidence).toBe('repository');
  });

  it('lets a file change one label and keeps the rest', () => {
    const result = parse('columns:\n  labels:\n    Review: needs-review\n');
    expect(result.process.columns.labels).toEqual({ ...LABEL_FOR_COLUMN, Review: 'needs-review' });
  });

  it('replaces the board map as a whole when one is given', () => {
    const result = parse('columns:\n  source: board-status\n  board:\n    Open: Ready\n    Closed: Verified\n');
    expect(result.process.columns.board).toEqual({ Open: 'Ready', Closed: 'Verified' });
  });

  it('reads the stale limit and the evidence flags', () => {
    const result = parse('stale:\n  idle-days: 30\nevidence:\n  closing-pull-request: false\n  exceptions: false\n');
    expect(result.process.stale.idleDays).toBe(30);
    expect(result.process.evidence).toMatchObject({ closingPullRequest: false, exceptions: false });
  });

  it('keeps the maintainer\'s example for HowMuchToday', () => {
    const result = parse('version: 1\ncolumns:\n  source: board-status\nevidence:\n  pull-request: optional\n  closing-pull-request: false\n');
    expect(result.process.columns.source).toBe('board-status');
    expect(result.process.evidence).toEqual({ pullRequest: 'optional', closingPullRequest: false, exceptions: true });
    expect(result.issues).toEqual([]);
  });
});

describe('parseProcess: a section with an error is ignored and the others still apply', () => {
  it('ignores a bad column source, with a warning that it was ignored, and applies evidence', () => {
    const result = parse('columns:\n  source: magic\nevidence:\n  pull-request: optional\n');
    expect(codes('columns:\n  source: magic\nevidence:\n  pull-request: optional\n')).toEqual(['error:process-invalid-column-source', 'warning:process-section-ignored']);
    expect(result.process.columns).toEqual(defaultProcess().columns);
    expect(result.sources).toEqual({ columns: 'default', evidence: 'repository', stale: 'default' });
    expect(result.process.evidence.pullRequest).toBe('optional');
  });

  it('ignores a column section whose values are wrong, whole, even the good ones', () => {
    const result = parse('columns:\n  source: board-status\n  labels:\n    Nonsense: x\n');
    expect(result.process.columns.source).toBe('labels');
    expect(result.sources.columns).toBe('default');
    expect(codes('columns:\n  source: board-status\n  labels:\n    Nonsense: x\n')).toEqual(['error:process-unknown-column', 'warning:process-section-ignored']);
  });

  it('reports each kind of mistake', () => {
    expect(codes('columns:\n  labels:\n    Review: ""\n')).toEqual(['error:process-invalid-label', 'warning:process-section-ignored']);
    expect(codes('columns:\n  labels:\n    Review: status:ready\n')).toEqual(['error:process-duplicate-label', 'warning:process-section-ignored']);
    expect(codes('columns:\n  labels: [a]\n')).toEqual(['error:process-section-not-a-mapping', 'warning:process-section-ignored']);
    expect(codes('columns:\n  board:\n    Done: Finished\n')).toEqual(['error:process-unknown-column', 'warning:process-section-ignored']);
    expect(codes('columns: [a]\n')).toEqual(['error:process-section-not-a-mapping', 'warning:process-section-ignored']);
    expect(codes('evidence:\n  pull-request: sometimes\n')).toEqual(['error:process-invalid-evidence-value', 'warning:process-section-ignored']);
    expect(codes('evidence:\n  exceptions: yes please\n')).toEqual(['error:process-invalid-evidence-value', 'warning:process-section-ignored']);
    expect(codes('stale:\n  idle-days: 0\n')).toEqual(['error:process-invalid-idle-days', 'warning:process-section-ignored']);
    expect(codes('stale:\n  idle-days: 2.5\n')).toEqual(['error:process-invalid-idle-days', 'warning:process-section-ignored']);
    expect(codes('stale:\n  idle-days: soon\n')).toEqual(['error:process-invalid-idle-days', 'warning:process-section-ignored']);
  });

  it('applies a section that only has a warning, and reports the unknown field', () => {
    const result = parse('stale:\n  idle-days: 7\n  colour: blue\n');
    expect(result.process.stale.idleDays).toBe(7);
    expect(result.sources.stale).toBe('repository');
    expect(result.issues.map((i) => `${i.severity}:${i.code}:${i.args?.field}`)).toEqual(['warning:unknown-field:stale.colour']);
  });
});

describe('parseProcess: a file that cannot be used at all', () => {
  it('ignores the whole file when it is not valid YAML', () => {
    const result = parse('columns: [unclosed');
    expect(result.process).toEqual(defaultProcess());
    expect(result.sources).toEqual({ columns: 'default', evidence: 'default', stale: 'default' });
    expect(codes('columns: [unclosed')).toEqual(['error:process-invalid-yaml']);
  });

  it('ignores the whole file when it is not a mapping, or of a version it does not know', () => {
    expect(codes('- a\n- b')).toEqual(['error:process-not-a-mapping']);
    expect(codes('version: 2\ncolumns:\n  source: board-status\n')).toEqual(['error:process-unsupported-version']);
    expect(parse('version: 2\ncolumns:\n  source: board-status\n').process.columns.source).toBe('labels');
  });

  it('warns about a top-level field it does not know and still reads the rest', () => {
    const result = parse('colours: x\nstale:\n  idle-days: 9\n');
    expect(result.process.stale.idleDays).toBe(9);
    expect(codes('colours: x\nstale:\n  idle-days: 9\n')).toEqual(['warning:unknown-field']);
  });

  it('labels each issue with the path of the file', () => {
    expect(parseProcess('owner/name/.weaver/process.yaml', 'stale: [x]').issues.every((i) => i.path === 'owner/name/.weaver/process.yaml')).toBe(true);
  });
});
