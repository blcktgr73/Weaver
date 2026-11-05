import { describe, expect, it } from 'vitest';
import {
  contractGaps,
  declaredTaskFieldsOf,
  findMismatches,
  loadWorkspace,
  parseArtifact,
  parseProcess,
  placeIssue,
  t,
  type MismatchCard,
  type TaskContract,
} from '../src';

// Neutral names only: the contract belongs to the organization (DEC-016 item 11).
const contractOf = (section: string): TaskContract => {
  const result = parseProcess('process.yaml', `task:\n${section}`);
  expect(result.issues).toEqual([]);
  return result.process.task as TaskContract;
};

const FIELDS = `
  fields:
    owner:
      required: true
      values: [alpha, beta]
      label: "owner:{value}"
    level:
      project-field: Level
    blocker:
      source: project
      project-field: Blocker
`;
const contract = contractOf(FIELDS);

const REPO = 'o/a';
const url = (n: number) => `https://github.com/o/a/issues/${n}`;
const req = `---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nrepository: ${REPO}\n---\n\n## Tasks\n`;
const task = (extra: string) =>
  `---\nid: TASK-001\ntype: task\ntitle: T\nrequirement: REQ-001\nstatus: draft\nrepository: ${REPO}\nissue: ${url(1)}\n${extra}---\n`;
const artifactsOf = (extra: string, options?: Parameters<typeof loadWorkspace>[1]) =>
  loadWorkspace([{ path: 'REQ-001.md', text: req }, { path: 'docs/tasks/TASK-001.md', text: task(extra) }], options).artifacts;
const card = (extra: Partial<MismatchCard> = {}): MismatchCard => ({
  repository: REPO,
  number: 1,
  title: 'Issue 1',
  url: url(1),
  placement: placeIssue({ state: 'open', labels: ['status:backlog'] }),
  ...extra,
});
const kinds = (list: { kind: string }[]) => list.map((m) => m.kind);

describe('contractGaps (DEC-016 item 9)', () => {
  it('is quiet when the file agrees with the contract and the board', () => {
    const fm = { owner: 'alpha', level: 'high' };
    expect(contractGaps(fm, contract)).toEqual([]);
    expect(contractGaps(fm, contract, { labels: ['owner:alpha'], fields: { Level: 'high' } })).toEqual([]);
  });

  it('reports a required field with no value, and a value outside the list', () => {
    expect(contractGaps({}, contract).map((g) => g.kind)).toEqual(['task-field-missing']);
    expect(contractGaps({ owner: 'gamma' }, contract)).toEqual([{ kind: 'task-field-value', args: { field: 'owner', value: 'gamma', values: 'alpha, beta' } }]);
  });

  it('reports a field that lives on the board but is also written in the file', () => {
    expect(contractGaps({ owner: 'alpha', blocker: 'waiting' }, contract)).toEqual([{ kind: 'task-field-in-file', args: { field: 'blocker' } }]);
  });

  it('reports a label that differs from the file, and says what the board shows', () => {
    expect(contractGaps({ owner: 'alpha' }, contract, { labels: ['owner:beta', 'task'] })).toEqual([
      { kind: 'task-field-differs', args: { field: 'owner', file: 'alpha', board: 'beta' } },
    ]);
    expect(contractGaps({ owner: 'alpha' }, contract, { labels: ['task'] })[0]?.args.board).toBe('-');
  });

  it('reports a Project field that differs, but only when the Project fields were read', () => {
    const fm = { owner: 'alpha', level: 'high' };
    expect(contractGaps(fm, contract, { labels: ['owner:alpha'], fields: { Level: 'low' } })).toEqual([
      { kind: 'task-field-differs', args: { field: 'level', file: 'high', board: 'low' } },
    ]);
    expect(contractGaps(fm, contract, { labels: ['owner:alpha'], fields: {} })[0]?.args).toEqual({ field: 'level', file: 'high', board: '-' });
    expect(contractGaps(fm, contract, { labels: ['owner:alpha'] })).toEqual([]);
  });

  it('does not judge an optional field that the file leaves empty', () => {
    expect(contractGaps({ owner: 'alpha' }, contract, { labels: ['owner:alpha'], fields: {} })).toEqual([]);
  });
});

describe('declared task fields are not unknown fields', () => {
  const text = task('owner: alpha\nextra: x\n');

  it('keeps the warning for every field when nothing is declared (behavior unchanged)', () => {
    const codes = parseArtifact('t.md', text).issues.map((i) => `${i.code}:${i.args?.field}`);
    expect(codes).toEqual(['unknown-field:owner', 'unknown-field:extra']);
  });

  it('accepts a declared field and still warns about one that is not declared', () => {
    const result = parseArtifact('t.md', text, { declaredTaskFields: ['owner'] });
    expect(result.issues.map((i) => i.args?.field)).toEqual(['extra']);
    expect(result.artifact?.kind === 'task' && result.artifact.frontmatter.owner).toBe('alpha');
  });

  it('applies to task files only', () => {
    const requirement = `---\nid: REQ-001\ntype: requirement\ntitle: First\nstatus: draft\nowner: alpha\n---\n\n## Tasks\n`;
    expect(parseArtifact('r.md', requirement, { declaredTaskFields: ['owner'] }).issues.some((i) => i.code === 'unknown-field')).toBe(false);
    const other = requirement.replace('owner: alpha', 'level: 1');
    expect(parseArtifact('r.md', other, { declaredTaskFields: ['level'] }).issues.some((i) => i.code === 'unknown-field')).toBe(true);
  });

  it('takes the fields from the process of the repository the task file is in', () => {
    const declared = [
      { root: 'a/', fields: ['owner'] },
      { root: 'a/sub/', fields: ['level'] },
      { root: 'b/', fields: ['other'] },
    ];
    expect(declaredTaskFieldsOf(declared, 'a/docs/tasks/TASK-001.md')).toEqual(['owner']);
    expect(declaredTaskFieldsOf(declared, 'a/sub/docs/TASK-002.md')).toEqual(['level']);
    expect(declaredTaskFieldsOf(declared, 'c/TASK-003.md')).toEqual([]);
    expect(declaredTaskFieldsOf([{ root: '', fields: ['owner'] }], 'docs/tasks/TASK-001.md')).toEqual(['owner']);
  });

  it('loadWorkspace asks for the fields by the path of each file', () => {
    const quiet = loadWorkspace([{ path: 'REQ-001.md', text: req }, { path: 'docs/tasks/TASK-001.md', text }], { declaredTaskFields: () => ['owner', 'extra'] });
    expect(quiet.issues.filter((i) => i.code === 'unknown-field')).toEqual([]);
  });
});

describe('findMismatches against the task contract (DEC-016)', () => {
  const contractFor = (repository: string) => (repository === REPO ? contract : undefined);

  it('reports the gaps of a task file, with the file to open', () => {
    const artifacts = artifactsOf('owner: gamma\nblocker: x\n', { declaredTaskFields: () => ['owner', 'blocker'] });
    const found = findMismatches({ artifacts, cards: [card({ labels: ['owner:alpha'] })], repositories: [REPO], contractFor });
    expect(kinds(found)).toEqual(['task-field-value', 'task-field-in-file']);
    expect(found[0]).toMatchObject({ subject: 'TASK-001', path: 'docs/tasks/TASK-001.md', args: { task: 'TASK-001', field: 'owner', value: 'gamma' } });
  });

  it('compares the file with the labels and Project fields of the card', () => {
    const artifacts = artifactsOf('owner: alpha\nlevel: high\n');
    const same = card({ labels: ['owner:alpha'], fields: { Level: 'high' } });
    expect(findMismatches({ artifacts, cards: [same], repositories: [REPO], contractFor })).toEqual([]);
    const differs = card({ labels: ['owner:beta'], fields: { Level: 'low' } });
    expect(findMismatches({ artifacts, cards: [differs], repositories: [REPO], contractFor }).map((m) => m.args.field)).toEqual(['owner', 'level']);
  });

  it('does not judge the board when the labels of the card were not read', () => {
    const artifacts = artifactsOf('owner: alpha\n');
    expect(findMismatches({ artifacts, cards: [card()], repositories: [REPO], contractFor })).toEqual([]);
  });

  it('is unchanged without a contract', () => {
    const artifacts = artifactsOf('owner: gamma\n');
    expect(findMismatches({ artifacts, cards: [card()], repositories: [REPO] })).toEqual([]);
    expect(findMismatches({ artifacts, cards: [card()], repositories: [REPO], contractFor: () => undefined })).toEqual([]);
  });
});

describe('a card with no file (DEC-016 item 3)', () => {
  const withFiles = artifactsOf('owner: alpha\n', { declaredTaskFields: () => ['owner'] });
  const lone = card({ number: 2, url: url(2), title: 'Light card' });

  it('is a mismatch when the process asks for a file, as before', () => {
    expect(kinds(findMismatches({ artifacts: withFiles, cards: [card(), lone], repositories: [REPO] }))).toEqual(['card-without-file']);
    expect(kinds(findMismatches({ artifacts: withFiles, cards: [card(), lone], repositories: [REPO], contractFor: () => contractOf(`  require-file: true${FIELDS}`) }))).toEqual(['card-without-file']);
  });

  it('is not a mismatch when the process lets a card be an Issue only', () => {
    const light = contractOf(`  require-file: false${FIELDS}`);
    expect(findMismatches({ artifacts: withFiles, cards: [card(), lone], repositories: [REPO], contractFor: () => light })).toEqual([]);
  });
});

describe('messages of the contract gaps', () => {
  it.each(['task-field-missing', 'task-field-value', 'task-field-differs', 'task-field-in-file'])('%s is in both languages', (kind) => {
    const args = { task: 'TASK-001', field: 'owner', value: 'x', values: 'a, b', file: 'a', board: 'b' };
    expect(t(`mismatch.${kind}` as never, 'en', args)).toContain('TASK-001');
    expect(t(`mismatch.${kind}` as never, 'ko', args)).toContain('TASK-001');
  });
});
