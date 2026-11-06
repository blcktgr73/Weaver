import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contributorFromForm, parseConfig, parseRoster, reachLabel, removeContributor, upsertContributor, type Contributor } from '../src';

const personal = [
  '# my configuration',
  'project:',
  '  owner: o',
  '  number: 1',
  'roster:',
  '  contributors:',
  '    - id: me # that is me',
  '      kind: human',
  '      github: me-dev # login',
  '',
].join('\n');

const agent: Contributor = { id: 'claude-code', kind: 'agent', tool: 'Claude Code', roles: ['implementer'], reach: [{ type: 'label', value: 'dispatch:claude-code' }] };

describe('upsertContributor', () => {
  it('adds an entry to the personal roster and keeps the comments', () => {
    const edit = upsertContributor(personal, agent, 'personal');
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    expect(edit.text).toContain('# my configuration');
    expect(edit.text).toContain('# that is me');
    const config = parseConfig('c.yaml', edit.text).config;
    expect(config?.roster?.contributors.map((c) => c.id)).toEqual(['me', 'claude-code']);
    expect(config?.roster?.contributors[1]).toMatchObject({ tool: 'Claude Code', roles: ['implementer'] });
  });

  it('creates the roster in a configuration that has none', () => {
    const edit = upsertContributor('project:\n  owner: o\n  number: 1\n', agent, 'personal');
    expect(edit.ok && parseConfig('c.yaml', edit.text).config?.roster?.contributors).toHaveLength(1);
  });

  it('starts a roster file from an empty text', () => {
    const edit = upsertContributor('', { id: 'maria', kind: 'human' }, 'file');
    expect(edit.ok && parseRoster('r.yaml', edit.text).roster?.contributors).toEqual([{ id: 'maria', kind: 'human' }]);
  });

  it('changes one entry, leaves the others and the comments, and drops a field that was cleared', () => {
    const edit = upsertContributor(personal, { id: 'me', kind: 'human', name: 'Me' }, 'personal', 'me');
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    expect(edit.text).toContain('# that is me');
    expect(edit.text).not.toContain('github');
    expect(parseConfig('c.yaml', edit.text).config?.roster?.contributors).toEqual([{ id: 'me', kind: 'human', name: 'Me' }]);
  });

  it('renames an entry when told which one it replaces', () => {
    const edit = upsertContributor(personal, { id: 'maria', kind: 'human' }, 'personal', 'ME');
    expect(edit.ok && parseConfig('c.yaml', edit.text).config?.roster?.contributors.map((c) => c.id)).toEqual(['maria']);
  });

  it('refuses an id that is taken, without regard to case, when adding or renaming', () => {
    expect(upsertContributor(personal, { id: 'ME', kind: 'human' }, 'personal')).toMatchObject({ ok: false, reason: 'duplicate' });
    const two = upsertContributor(personal, { id: 'you', kind: 'human' }, 'personal');
    if (!two.ok) throw new Error('setup');
    expect(upsertContributor(two.text, { id: 'YOU', kind: 'human' }, 'personal', 'me')).toMatchObject({ ok: false, reason: 'duplicate' });
  });

  it('says so when the entry to change is not there', () => {
    expect(upsertContributor(personal, agent, 'personal', 'ghost')).toMatchObject({ ok: false, reason: 'not-found' });
  });

  it('refuses an entry that the reader would reject', () => {
    expect(upsertContributor(personal, { id: '', kind: 'human' }, 'personal')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(upsertContributor(personal, { id: 'x', kind: 'robot' as never }, 'personal')).toMatchObject({ ok: false, reason: 'invalid', issue: { code: 'roster-invalid-kind' } });
  });

  it('refuses a text that is not YAML or whose contributors is not a list', () => {
    expect(upsertContributor('a: [', agent, 'file')).toMatchObject({ ok: false, reason: 'invalid-yaml' });
    expect(upsertContributor('contributors: nope\n', agent, 'file')).toMatchObject({ ok: false, reason: 'not-a-list' });
  });

  it('keeps every comment of the sample roster file when one entry is added', () => {
    const sample = readFileSync(resolve(__dirname, '../../../examples/roster.example.yaml'), 'utf8');
    const edit = upsertContributor(sample, { id: 'new-person', kind: 'human' }, 'file');
    expect(edit.ok).toBe(true);
    if (!edit.ok) return;
    for (const line of sample.split('\n').filter((l) => l.trimStart().startsWith('#'))) expect(edit.text).toContain(line.trim());
    expect(parseRoster('r.yaml', edit.text).roster?.contributors.at(-1)?.id).toBe('new-person');
  });
});

describe('removeContributor', () => {
  it('removes one entry and keeps the rest', () => {
    const added = upsertContributor(personal, agent, 'personal');
    if (!added.ok) throw new Error('setup');
    const edit = removeContributor(added.text, 'Claude-Code', 'personal');
    expect(edit.ok && parseConfig('c.yaml', edit.text).config?.roster?.contributors.map((c) => c.id)).toEqual(['me']);
  });

  it('says so when the entry is not there', () => {
    expect(removeContributor(personal, 'ghost', 'personal')).toMatchObject({ ok: false, reason: 'not-found' });
    expect(removeContributor('project: {}\n', 'me', 'personal')).toMatchObject({ ok: false, reason: 'not-found' });
  });
});

describe('contributorFromForm', () => {
  it('leaves out the answers that are empty and splits the roles', () => {
    expect(contributorFromForm({ id: ' maria ', kind: 'human', name: '', github: ' maria-dev', roles: 'owner, approver,' })).toEqual({
      id: 'maria',
      kind: 'human',
      github: 'maria-dev',
      roles: ['owner', 'approver'],
    });
  });

  it('turns the label into the reach entry Weaver acts on', () => {
    expect(contributorFromForm({ id: 'bot', kind: 'agent', tool: 'Claude Code', label: 'dispatch:bot' }).reach).toEqual([{ type: 'label', value: 'dispatch:bot' }]);
  });

  it('keeps a reach the form cannot show', () => {
    const webhook: Contributor = { id: 'bot', kind: 'agent', reach: [{ type: 'webhook', value: 'hook-1' }, { type: 'label', value: 'old' }] };
    expect(contributorFromForm({ id: 'bot', kind: 'agent', label: 'new' }, webhook).reach).toEqual([{ type: 'label', value: 'new' }, { type: 'webhook', value: 'hook-1' }]);
    expect(contributorFromForm({ id: 'bot', kind: 'agent', label: '' }, webhook).reach).toEqual([{ type: 'webhook', value: 'hook-1' }]);
    expect(reachLabel(webhook)).toBe('old');
    const words: Contributor = { id: 'bot', kind: 'agent', reach: 'ask in chat' };
    expect(contributorFromForm({ id: 'bot', kind: 'agent' }, words).reach).toBe('ask in chat');
    expect(contributorFromForm({ id: 'bot', kind: 'agent', label: 'x' }, words).reach).toEqual([{ type: 'label', value: 'x' }]);
  });
});
