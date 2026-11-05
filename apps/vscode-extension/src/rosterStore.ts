import type * as vscode from 'vscode';
import { overlayRoster, parseSharedRoster, Roster, RosterOverlay, RosterRef, snapshotAge, SnapshotAge, ValidationIssue } from '@palab/weaver-markdown';
import type { UserConfigResult } from './userConfig';
import { refreshRosterFile, RosterCacheEntry, rosterCacheKey } from '@palab/weaver-github';

const KEY = 'weaver.roster.cache';

/** What is known of the shared roster a repository (or the personal configuration) points to (DEC-017). */
export interface SharedRoster {
  ref: RosterRef;
  /** The entries that could be read from the kept copy. Absent when there is no copy, or it has no usable entry. */
  roster?: Roster;
  /** Warnings about the file's own content. */
  issues: ValidationIssue[];
  /** `read`: there is a copy. `missing`: GitHub said the file is not there. `none`: nothing is kept (never read, or unreadable). */
  state: 'read' | 'missing' | 'none';
  /** The last time GitHub confirmed the copy. */
  readAt?: string;
}

/** The label of a reference, as it is shown: `owner/name path@ref`. */
export function describeRef(ref: RosterRef): string {
  return `${ref.repository}/${ref.path}${ref.ref ? `@${ref.ref}` : ''}`;
}

/**
 * The shared roster, kept between runs on this computer (DEC-017 item 7). The editor draws from the
 * kept copy at once; `refresh` asks GitHub with a conditional request and keeps the answer. With no
 * network or no access, the kept copy is used, and its age shows. Nothing here is ever written to a repository.
 */
export class RosterStore {
  private memento: vscode.Memento | undefined;
  private entries = new Map<string, RosterCacheEntry>();
  private current: RosterRef | undefined;
  /** References that were asked and could not be read, with no copy to fall back on. */
  private unreadable = new Set<string>();

  init(memento: vscode.Memento): void {
    this.memento = memento;
    this.entries = new Map(Object.entries(memento.get<Record<string, RosterCacheEntry>>(KEY, {})));
    this.unreadable.clear();
  }

  /** Set on each workspace read: the reference the repositories in the workspace declare, or else the personal one. */
  setCurrent(ref: RosterRef | undefined): void {
    this.current = ref;
  }

  currentRef(): RosterRef | undefined {
    return this.current;
  }

  /** The kept copy of a reference, read as a shared roster. */
  shared(ref: RosterRef | undefined = this.current): SharedRoster | undefined {
    if (!ref) return undefined;
    const key = rosterCacheKey(ref);
    const entry = this.entries.get(key);
    if (!entry) return { ref, issues: [], state: 'none' };
    if (entry.missing) return { ref, issues: [], state: 'missing', readAt: entry.readAt };
    const parsed = parseSharedRoster(describeRef(ref), entry.text);
    return { ref, ...(parsed.roster ? { roster: parsed.roster } : {}), issues: parsed.issues, state: 'read', readAt: entry.readAt };
  }

  /** True when the reference was asked and nothing could be read, and no copy is kept. */
  isUnreadable(ref: RosterRef): boolean {
    return this.unreadable.has(rosterCacheKey(ref)) && !this.entries.has(rosterCacheKey(ref));
  }

  /** Asks GitHub whether the current reference changed. True when what is shown may differ now. */
  async refresh(token: string): Promise<boolean> {
    const ref = this.current;
    if (!ref) return false;
    const key = rosterCacheKey(ref);
    const result = await refreshRosterFile(token, ref, this.entries.get(key));
    if (result.entry) this.entries.set(key, result.entry);
    const before = this.unreadable.has(key);
    if (result.error) this.unreadable.add(key);
    else this.unreadable.delete(key);
    void this.memento?.update(KEY, Object.fromEntries(this.entries));
    return result.changed || before !== this.unreadable.has(key);
  }

  /** The personal roster laid over the shared one, when there is a shared one (DEC-017 item 6). */
  combined(personal: Roster | undefined): RosterOverlay | undefined {
    return overlayRoster(this.shared()?.roster, personal);
  }

  /** What the Overview shows about the roster: where it is read from and how old the copy is. */
  shown(now: Date = new Date()): { reference: string; age?: SnapshotAge } | undefined {
    const shared = this.shared();
    if (!shared) return undefined;
    return { reference: describeRef(shared.ref), ...(shared.readAt ? { age: snapshotAge(shared.readAt, now) } : {}) };
  }
}

/** One store for the whole extension, started in `activate`. */
export const rosterStore = new RosterStore();

/** The roster tasks are judged against: the shared one with the personal one laid over it. None when it has no entry. */
export function rosterOf(user: UserConfigResult): Roster | undefined {
  const combined = rosterStore.combined(user.kind === 'ok' ? user.config.roster : undefined)?.roster;
  return combined && combined.contributors.length > 0 ? combined : undefined;
}
