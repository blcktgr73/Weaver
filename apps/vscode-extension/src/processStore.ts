import type * as vscode from 'vscode';
import { ColumnRules, parseProcess, ProcessConfig } from '@palab/weaver-markdown';
import { ProcessCacheEntry, refreshProcessFiles } from '@palab/weaver-github';

const KEY = 'weaver.process.cache';

/**
 * The process of each repository (DEC-015), kept between runs so the Overview can draw its first
 * picture from the last answer and check for a change afterwards. A repository that was never
 * asked has no answer here, and the Overview waits for it rather than guess.
 */
export class ProcessStore {
  private memento: vscode.Memento | undefined;
  private entries = new Map<string, ProcessCacheEntry>();
  private parsed = new Map<string, ProcessConfig & { staleFromFile: boolean }>();

  init(memento: vscode.Memento): void {
    this.memento = memento;
    this.entries = new Map(Object.entries(memento.get<Record<string, ProcessCacheEntry>>(KEY, {})));
    this.parsed.clear();
  }

  /** True when the repository was asked at least once, so there is an answer to show first. */
  has(repository: string): boolean {
    return this.entries.has(repository.toLowerCase());
  }

  /** Asks the repositories for changes, keeps the answers, and says whether anything shown may differ now. */
  async refresh(token: string, repositories: readonly string[]): Promise<boolean> {
    const results = await refreshProcessFiles(token, repositories, (repository) => this.entries.get(repository.toLowerCase()));
    let changed = false;
    for (const result of results) {
      if (result.entry) this.entries.set(result.repository.toLowerCase(), result.entry);
      if (result.changed) {
        this.parsed.delete(result.repository.toLowerCase());
        changed = true;
      }
    }
    void this.memento?.update(KEY, Object.fromEntries(this.entries));
    return changed;
  }

  /** What the repository's file sets, with the defaults for the rest. None when it has no file. */
  private config(repository: string): (ProcessConfig & { staleFromFile: boolean }) | undefined {
    const key = repository.toLowerCase();
    const known = this.parsed.get(key);
    if (known) return known;
    const entry = this.entries.get(key);
    if (!entry || entry.missing) return undefined;
    const result = parseProcess(`${repository}/.weaver/process.yaml`, entry.text);
    const config = { ...result.process, staleFromFile: result.sources.stale === 'repository' };
    this.parsed.set(key, config);
    return config;
  }

  rulesFor = (repository: string): ColumnRules | undefined => this.config(repository)?.columns;

  /** The idle days the repository's file sets, or none when it leaves them to the default. */
  staleDaysFor = (repository: string): number | undefined => {
    const config = this.config(repository);
    return config?.staleFromFile ? config.stale.idleDays : undefined;
  };
}

/** One store for the whole extension, started in `activate`. */
export const processStore = new ProcessStore();
