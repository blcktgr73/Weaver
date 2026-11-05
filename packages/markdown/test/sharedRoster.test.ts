import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { overlayRoster, parseConfig, parseProcess, parseRoster, parseSharedRoster, reachEntries, serializeConfig, type Roster } from '../src';

const codes = (issues: { severity: string; code: string }[]) => issues.map((i) => `${i.severity}:${i.code}`);

describe('roster.example.yaml', () => {
  const text = readFileSync(resolve(__dirname, '../../../examples/roster.example.yaml'), 'utf8');

  it('is read with no issue, as a shared roster and as a strict one', () => {
    for (const result of [parseSharedRoster('roster.yaml', text), parseRoster('roster.yaml', text)]) {
      expect(result.issues).toEqual([]);
      expect(result.roster?.contributors.map((c) => c.id)).toEqual(['maria', 'claude-code', 'reviewer-agent']);
    }
  });

  it('shows the three layers: roles, and reach as {type, value} entries', () => {
    const roster = parseSharedRoster('roster.yaml', text).roster as Roster;
    const reviewer = roster.contributors[2];
    expect(reviewer.roles).toEqual(['reviewer']);
    expect(reachEntries(reviewer)).toEqual([
      { type: 'label', value: 'dispatch:reviewer-agent' },
      { type: 'text', value: 'also reachable by a comment in the Issue' },
    ]);
  });
});

describe('reach and roles', () => {
  it('reads a plain string reach as a text entry (the form of DEC-013)', () => {
    const roster = parseRoster('r', 'contributors:\n  - id: bot\n    kind: agent\n    tool: t\n    reach: the maintainer session\n').roster as Roster;
    expect(roster.contributors[0].reach).toBe('the maintainer session');
    expect(reachEntries(roster.contributors[0])).toEqual([{ type: 'text', value: 'the maintainer session' }]);
  });

  it('accepts one {type, value} entry without a list', () => {
    const roster = parseRoster('r', 'contributors:\n  - id: bot\n    kind: agent\n    tool: t\n    reach: {type: label, value: dispatch:bot}\n').roster as Roster;
    expect(reachEntries(roster.contributors[0])).toEqual([{ type: 'label', value: 'dispatch:bot' }]);
  });

  it('drops a reach entry or roles that are wrong, with a warning', () => {
    const result = parseRoster('r', 'contributors:\n  - id: bot\n    kind: agent\n    tool: t\n    roles: reviewer\n    reach:\n      - {type: label}\n      - {type: text, value: ok}\n');
    expect(codes(result.issues)).toEqual(['warning:roster-invalid-roles', 'warning:roster-invalid-reach']);
    expect(reachEntries((result.roster as Roster).contributors[0])).toEqual([{ type: 'text', value: 'ok' }]);
  });

  it('warns about a field outside the schema, such as a token put there by mistake', () => {
    const result = parseSharedRoster('r', 'contributors:\n  - id: bot\n    kind: agent\n    tool: t\n    reach: x\n    token: abc\n');
    expect(codes(result.issues)).toEqual(['warning:unknown-field']);
    expect(result.issues[0].args).toEqual({ field: 'roster.contributors.token' });
    expect(result.roster?.contributors[0]).not.toHaveProperty('token');
  });
});

describe('parseSharedRoster', () => {
  it('leaves out an entry that is wrong and keeps the others, with warnings and no error', () => {
    const result = parseSharedRoster('r', 'contributors:\n  - id: maria\n    kind: human\n  - id: bad\n    kind: robot\n  - kind: agent\n  - id: Maria\n    kind: human\n');
    expect(result.roster?.contributors.map((c) => c.id)).toEqual(['maria']);
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(codes(result.issues)).toEqual(['warning:roster-invalid-kind', 'warning:missing-field', 'warning:roster-duplicate-id']);
  });

  it('gives no roster, and only warnings, for a file that is not YAML, not a mapping, or empty', () => {
    for (const text of ['a: [', '- x\n', 'contributors: []\n', '']) {
      const result = parseSharedRoster('r', text);
      expect(result.roster).toBeUndefined();
      expect(result.issues.every((i) => i.severity === 'warning')).toBe(true);
    }
  });
});

describe('overlayRoster (DEC-017 item 6)', () => {
  const shared: Roster = {
    contributors: [
      { id: 'maria', kind: 'human', github: 'maria-dev', roles: ['approver'] },
      { id: 'bot', kind: 'agent', tool: 'Claude Code', roles: ['implementer'], reach: [{ type: 'label', value: 'dispatch:bot' }] },
    ],
  };

  it('is the personal roster as it is when nothing is shared, and nothing when both are absent', () => {
    const personal: Roster = { contributors: [{ id: 'me', kind: 'human' }] };
    expect(overlayRoster(undefined, personal)?.roster).toBe(personal);
    expect(overlayRoster(undefined, personal)?.origins.get('me')).toBe('personal');
    expect(overlayRoster(undefined, undefined)).toBeUndefined();
  });

  it('keeps the shared entries when there is no personal roster', () => {
    const overlay = overlayRoster(shared, undefined);
    expect(overlay?.roster.contributors.map((c) => c.id)).toEqual(['maria', 'bot']);
    expect([...(overlay?.origins.values() ?? [])]).toEqual(['shared', 'shared']);
  });

  it('lets the personal entry set the fields it names, replaces roles and reach whole, and keeps the rest', () => {
    const overlay = overlayRoster(shared, { contributors: [{ id: 'BOT', kind: 'agent', model: 'opus', roles: ['reviewer'], reach: 'my session' }] });
    const bot = overlay?.roster.contributors.find((c) => c.id === 'bot');
    expect(bot).toEqual({ id: 'bot', kind: 'agent', tool: 'Claude Code', model: 'opus', roles: ['reviewer'], reach: 'my session' });
    expect(overlay?.origins.get('bot')).toBe('both');
    expect(overlay?.origins.get('maria')).toBe('shared');
  });

  it('adds an id only in the personal roster and never removes a shared one', () => {
    const overlay = overlayRoster(shared, { contributors: [{ id: 'me', kind: 'human' }] });
    expect(overlay?.roster.contributors.map((c) => c.id)).toEqual(['maria', 'bot', 'me']);
    expect(overlay?.origins.get('me')).toBe('personal');
  });
});

describe('the reference', () => {
  it('is read from the process file, and a bad one is a warning that leaves the process alone', () => {
    const good = parseProcess('p', 'version: 1\nroster:\n  from: {repository: my-org/agents, path: roster.yaml, ref: main}\n');
    expect(good.issues).toEqual([]);
    expect(good.rosterRef).toEqual({ repository: 'my-org/agents', path: 'roster.yaml', ref: 'main' });
    expect(good.sources).toEqual({ columns: 'default', evidence: 'default', stale: 'default', task: 'default' });

    const noRef = parseProcess('p', 'roster:\n  from: {repository: my-org/agents, path: sub/roster.yaml}\n');
    expect(noRef.rosterRef).toEqual({ repository: 'my-org/agents', path: 'sub/roster.yaml' });

    for (const from of ['{repository: agents, path: r.yaml}', '{repository: o/a}', '{repository: o/a, path: ../r.yaml}', '{repository: o/a, path: /r.yaml}', 'text']) {
      const bad = parseProcess('p', `roster:\n  from: ${from}\n`);
      expect(bad.rosterRef).toBeUndefined();
      expect(codes(bad.issues)).toEqual(['warning:roster-invalid-reference']);
    }
  });

  it('is read from the personal configuration, which may hold nothing but the reference, and is written back', () => {
    const text = 'project: {owner: me, number: 3}\nroster:\n  from: {repository: my-org/agents, path: roster.yaml}\n';
    const result = parseConfig('c', text);
    expect(result.issues).toEqual([]);
    expect(result.config?.roster).toEqual({ contributors: [], from: { repository: 'my-org/agents', path: 'roster.yaml' } });
    const again = parseConfig('c', serializeConfig(result.config as NonNullable<typeof result.config>));
    expect(again.config?.roster).toEqual(result.config?.roster);
  });
});
