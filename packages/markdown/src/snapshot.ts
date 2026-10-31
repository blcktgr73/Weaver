/** The last board read from GitHub, kept on the user's computer (DEC-011). */
export interface BoardSnapshot<Card> {
  version: 1;
  project: { owner: string; number: number };
  title: string;
  /** When the read finished, as an ISO date. */
  readAt: string;
  cards: Card[];
}

export function makeSnapshot<Card>(project: { owner: string; number: number }, title: string, cards: Card[], now: Date): BoardSnapshot<Card> {
  return { version: 1, project: { owner: project.owner, number: project.number }, title, readAt: now.toISOString(), cards };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The kept board when it can be trusted: the same Project as the registry now names, a valid date,
 * and cards that have the fields the board needs. Anything else is ignored.
 */
export function readSnapshot<Card>(raw: unknown, project: { owner: string; number: number }): BoardSnapshot<Card> | undefined {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.project)) return undefined;
  if (typeof raw.project.owner !== 'string' || raw.project.owner.toLowerCase() !== project.owner.toLowerCase()) return undefined;
  if (raw.project.number !== project.number) return undefined;
  if (typeof raw.title !== 'string' || typeof raw.readAt !== 'string' || Number.isNaN(Date.parse(raw.readAt))) return undefined;
  if (!Array.isArray(raw.cards)) return undefined;
  const sound = raw.cards.every(
    (card) =>
      isRecord(card) &&
      typeof card.repository === 'string' &&
      typeof card.number === 'number' &&
      typeof card.title === 'string' &&
      typeof card.url === 'string' &&
      isRecord(card.placement) &&
      typeof card.placement.column === 'string',
  );
  if (!sound) return undefined;
  return raw as unknown as BoardSnapshot<Card>;
}

export type SnapshotAge = { unit: 'minutes' | 'hours' | 'days'; count: number };

/** How long ago a read was, in the largest whole unit; under a minute counts as one minute. */
export function snapshotAge(readAt: string, now: Date): SnapshotAge {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(readAt)) / 60000));
  if (minutes < 60) return { unit: 'minutes', count: Math.max(1, minutes) };
  if (minutes < 60 * 24) return { unit: 'hours', count: Math.floor(minutes / 60) };
  return { unit: 'days', count: Math.floor(minutes / (60 * 24)) };
}
