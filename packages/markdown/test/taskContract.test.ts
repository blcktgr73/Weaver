import { describe, expect, it } from 'vitest';
import { labelOf, parseProcess, planTaskFields, t, validationKey } from '../src';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';

// Neutral names only: the contract belongs to the organization (DEC-016 item 11).
const SECTION = `
task:
  require-file: true
  fields:
    owner:
      required: true
      values: [alpha, beta]
      label: "owner:{value}"
    priority:
      values: [P0, P1]
      source: project
      project-field: Priority
    note:
  body:
    sections: [Context, Done when]
`;

const issues = (text: string) => parseProcess('process.yaml', text).issues;
const codes = (text: string) => issues(text).map((i) => `${i.severity}:${i.code}`);

describe('parseProcess: the task section (DEC-016)', () => {
  it('has no contract without the section, and the behavior is unchanged', () => {
    const result = parseProcess('process.yaml', 'columns:\n  source: labels\n');
    expect(result.process.task).toBeUndefined();
    expect(result.sources.task).toBe('default');
    expect(result.issues).toEqual([]);
  });

  it('reads require-file, fields, and the body sections', () => {
    const result = parseProcess('process.yaml', SECTION);
    expect(result.issues).toEqual([]);
    expect(result.sources.task).toBe('repository');
    expect(result.process.task).toEqual({
      requireFile: true,
      fields: [
        { name: 'owner', required: true, source: 'file', values: ['alpha', 'beta'], label: 'owner:{value}' },
        { name: 'priority', required: false, source: 'project', values: ['P0', 'P1'], projectField: 'Priority' },
        { name: 'note', required: false, source: 'file' },
      ],
      sections: ['Context', 'Done when'],
    });
  });

  it('lets a light card be an Issue only', () => {
    expect(parseProcess('p', 'task:\n  require-file: false\n').process.task?.requireFile).toBe(false);
  });

  it('ignores the section as a whole when one field is wrong, and the other sections still apply', () => {
    const text = 'stale:\n  idle-days: 5\ntask:\n  fields:\n    Bad_Name: {}\n';
    const result = parseProcess('p', text);
    expect(codes(text)).toEqual(['error:process-task-invalid-field-name', 'warning:process-section-ignored']);
    expect(result.process.task).toBeUndefined();
    expect(result.sources).toMatchObject({ task: 'default', stale: 'repository' });
  });

  it.each([
    ['a name that Weaver owns', 'task:\n  fields:\n    assignee: {}\n', 'process-task-reserved-field'],
    ['a name that Weaver owns, written with a hyphen', 'task:\n  fields:\n    assignee-type: {}\n', 'process-task-reserved-field'],
    ['a label with no {value}', 'task:\n  fields:\n    owner:\n      label: "owner"\n', 'process-task-label-template'],
    ['both a label and a project-field', 'task:\n  fields:\n    owner:\n      label: "o:{value}"\n      project-field: Owner\n', 'process-task-two-mappings'],
    ['a project field with nowhere to live', 'task:\n  fields:\n    blocker:\n      source: project\n', 'process-task-source-without-mapping'],
    ['a source that is not file or project', 'task:\n  fields:\n    owner:\n      source: board\n', 'process-task-invalid-value'],
    ['an empty values list', 'task:\n  fields:\n    owner:\n      values: []\n', 'process-task-invalid-value'],
    ['a required that is not a boolean', 'task:\n  fields:\n    owner:\n      required: yes please\n', 'process-task-invalid-value'],
    ['a require-file that is not a boolean', 'task:\n  require-file: sometimes\n', 'process-task-invalid-value'],
    ['body sections that are not a list', 'task:\n  body:\n    sections: Context\n', 'process-task-invalid-value'],
    ['fields that are not a mapping', 'task:\n  fields: [owner]\n', 'process-section-not-a-mapping'],
  ])('reports %s as an error of the section', (_name, text, code) => {
    expect(codes(text)).toContain(`error:${code}`);
    expect(parseProcess('p', text).process.task).toBeUndefined();
  });

  it('warns about a key it does not know and still reads the section', () => {
    const result = parseProcess('p', 'task:\n  extra: 1\n  fields:\n    owner:\n      colour: red\n');
    expect(result.issues.map((i) => `${i.severity}:${i.code}`)).toEqual(['warning:unknown-field', 'warning:unknown-field']);
    expect(result.process.task?.fields.map((f) => f.name)).toEqual(['owner']);
  });

  it('has an English and a Korean message for every code it raises', () => {
    for (const text of [SECTION, 'task:\n  fields:\n    assignee: {}\n', 'task:\n  fields:\n    blocker:\n      source: project\n', 'task:\n  fields:\n    o:\n      label: x\n', 'task:\n  fields:\n    o:\n      label: "a:{value}"\n      project-field: P\n', 'task:\n  fields:\n    Bad: {}\n', 'task:\n  require-file: 3\n']) {
      for (const issue of issues(text)) {
        expect(en).toHaveProperty([validationKey(issue.code)]);
        expect(ko).toHaveProperty([validationKey(issue.code)]);
      }
    }
  });
});

describe('planTaskFields', () => {
  const contract = parseProcess('p', SECTION).process.task!;

  it('puts a file field in the task file and its label on the Issue, and a project field on the card only', () => {
    const plan = planTaskFields(contract, { owner: 'alpha', priority: 'P1', note: 'see the thread' });
    expect(plan.gaps).toEqual([]);
    expect(plan.fileFields).toEqual([
      { name: 'owner', value: 'alpha' },
      { name: 'note', value: 'see the thread' },
    ]);
    expect(plan.labels).toEqual(['owner:alpha']);
    expect(plan.projectFields).toEqual([{ field: 'Priority', value: 'P1' }]);
    expect(plan.sections).toEqual(['Context', 'Done when']);
  });

  it('stops with a gap for a required field with no value, a value outside the list, and a field not declared', () => {
    expect(planTaskFields(contract, {}).gaps).toEqual([{ code: 'gap.task-field-missing', args: { field: 'owner' } }]);
    expect(planTaskFields(contract, { owner: 'gamma' }).gaps).toEqual([{ code: 'gap.task-field-value', args: { field: 'owner', value: 'gamma', values: ['alpha', 'beta'] } }]);
    expect(planTaskFields(contract, { owner: 'alpha', size: 'L' }).gaps).toEqual([{ code: 'gap.task-field-undeclared', args: { field: 'size' } }]);
  });

  it('leaves an optional field with no value out, and trims what was given', () => {
    const plan = planTaskFields(contract, { owner: ' beta ' });
    expect(plan.fileFields).toEqual([{ name: 'owner', value: 'beta' }]);
    expect(plan.projectFields).toEqual([]);
  });

  it('has messages for its gaps in both languages', () => {
    for (const gap of planTaskFields(contract, { owner: 'gamma', size: 'L' }).gaps.concat(planTaskFields(contract, {}).gaps)) {
      expect(t(gap.code, 'en', gap.args)).not.toContain('{');
      expect(t(gap.code, 'ko', gap.args)).not.toContain('{');
    }
  });

  it('fills a label template', () => {
    expect(labelOf('owner:{value}', 'alpha')).toBe('owner:alpha');
  });
});
