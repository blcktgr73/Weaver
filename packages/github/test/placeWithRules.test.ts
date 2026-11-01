import { describe, expect, it } from 'vitest';
import { defaultProcess, parseProcess, placeIssue } from '@palab/weaver-markdown';
import { placeWithRules, type ProjectCard } from '../src';

const card = (repository: string, boardStatus?: string): ProjectCard => {
  const base = { state: 'open' as const, labels: ['status:ready'], ...(boardStatus ? { boardStatus } : {}) };
  return { repository, number: 1, title: 'x', url: `https://github.com/${repository}/issues/1`, assignees: [], ...base, placement: placeIssue(base) };
};

describe('placeWithRules', () => {
  const board = parseProcess('.weaver/process.yaml', 'columns:\n  source: board-status\n').process.columns;

  it('places each card with the rules of its repository and leaves the others as they are', () => {
    const a = card('me/a', 'In Progress');
    const b = card('me/b', 'In Progress');
    const [placedA, placedB] = placeWithRules([a, b], (repository) => (repository === 'me/a' ? board : undefined));
    expect(placedA.placement.column).toBe('In progress');
    expect(placedB).toBe(b);
    expect(placedB.placement.column).toBe('Ready');
  });

  it('does not change the cards it was given', () => {
    const a = card('me/a', 'Done');
    placeWithRules([a], () => board);
    expect(a.placement.column).toBe('Ready');
  });

  it('gives the same placement with the default rules', () => {
    const a = card('me/a', 'In Progress');
    expect(placeWithRules([a], () => defaultProcess().columns)[0].placement).toEqual(a.placement);
  });
});
