import { describe, expect, it } from 'vitest';
import { formatNotice, LOCALES, parseArtifact, pickLocale, t, validationKey } from '../src';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';

const PLACEHOLDER = /\{(\w+)\}/g;
const texts = (message: string | { one: string; other: string }) =>
  typeof message === 'string' ? [message] : [message.one, message.other];
const placeholders = (message: string | { one: string; other: string }) =>
  new Set(texts(message).flatMap((text) => [...text.matchAll(PLACEHOLDER)].map((m) => m[1])));

describe('message catalogs', () => {
  it('has Korean for every English key and nothing extra', () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });
  it('keeps the same placeholders in every language', () => {
    for (const [key, message] of Object.entries(en)) {
      const english = placeholders(message);
      const korean = placeholders((ko as Record<string, typeof message>)[key]);
      expect([key, [...korean].sort()]).toEqual([key, [...english].sort()]);
    }
  });
  it('supports exactly the declared locales', () => {
    expect([...LOCALES]).toEqual(['en', 'ko']);
  });
});

describe('t', () => {
  it('fills placeholders and joins lists', () => {
    expect(t('gap.multiple-status-labels', 'en', { columns: ['Ready', 'Review'] })).toBe(
      'multiple status labels: Ready, Review',
    );
  });
  it('picks singular or plural by count', () => {
    expect(t('move.remove-labels', 'en', { labels: ['a'], count: 1 })).toBe('Remove label: a');
    expect(t('move.remove-labels', 'en', { labels: ['a', 'b'], count: 2 })).toBe('Remove labels: a, b');
  });
  it('leaves an unknown placeholder visible instead of dropping it', () => {
    expect(t('move.add-label', 'en')).toBe('Add label: {label}');
  });
  it('falls back to English for an unknown locale', () => {
    expect(t('gap.no-status-label', 'fr' as never)).toBe('no status label');
  });
});

describe('pickLocale', () => {
  it('follows an explicit choice first', () => {
    expect(pickLocale('ko', 'en-US')).toBe('ko');
    expect(pickLocale('en', 'ko')).toBe('en');
  });
  it('follows the host language on auto and defaults to English', () => {
    expect(pickLocale('auto', 'ko')).toBe('ko');
    expect(pickLocale('auto', 'ko-KR')).toBe('ko');
    expect(pickLocale('auto', 'ja')).toBe('en');
    expect(pickLocale(undefined, undefined)).toBe('en');
  });
});

describe('validation messages', () => {
  it('has a catalog entry for every code the parser can emit', () => {
    const text = '---\nid: x\ntype: requirement\ntitle: ""\nstatus: bad\nrepository: no\nstory_ids: nope\nzzz: 1\n---\n';
    const { issues } = parseArtifact('r.md', text);
    expect(issues.length).toBeGreaterThan(3);
    for (const issue of issues) {
      expect(en).toHaveProperty([validationKey(issue.code)]);
      const english = t(validationKey(issue.code), 'en', issue.args);
      const korean = t(validationKey(issue.code), 'ko', issue.args);
      expect(english).not.toMatch(PLACEHOLDER);
      expect(korean).not.toMatch(PLACEHOLDER);
    }
  });
  it('renders a notice in the chosen language', () => {
    expect(formatNotice({ code: 'validation.missing-field', args: { field: 'id' } }, 'ko')).toBe(
      '필수 항목이 없거나 비어 있습니다: "id"',
    );
  });
});
