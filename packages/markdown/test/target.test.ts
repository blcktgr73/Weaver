import { describe, expect, it } from 'vitest';
import { documentKindOf, loadWorkspace } from '../src';

const REQ = `---
id: REQ-009
type: requirement
title: A requirement
status: draft
---
## Acceptance criteria
- one
## Tasks
- \`TASK-009\` a task
`;
const TASK = `---
id: TASK-009
type: task
title: A task
requirement: REQ-009
status: ready
---
`;
const README = '# Just a readme\n\nNo frontmatter here.\n';

const { artifacts } = loadWorkspace([
  { path: 'docs/requirements/REQ-009.md', text: REQ },
  { path: 'docs/tasks/TASK-009.md', text: TASK },
  { path: 'README.md', text: README },
]);

describe('documentKindOf', () => {
  it('names requirement and task files', () => {
    expect(documentKindOf(artifacts, 'docs/requirements/REQ-009.md')).toBe('requirement');
    expect(documentKindOf(artifacts, 'docs/tasks/TASK-009.md')).toBe('task');
  });

  it('treats ordinary Markdown and unknown paths as none', () => {
    expect(documentKindOf(artifacts, 'README.md')).toBe('none');
    expect(documentKindOf(artifacts, 'docs/missing.md')).toBe('none');
  });
});
