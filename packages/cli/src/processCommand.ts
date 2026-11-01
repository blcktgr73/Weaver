import { formatNotice, Locale, parseProcess, ProcessConfig, ProcessSection, SectionSource, t, defaultProcess, validationKey } from '@palab/weaver-markdown';
import { fetchProcessFile, type FetchFn } from '@palab/weaver-github';

/** Runs `work` on every item, at most `limit` at a time, and returns the results in the order of the items. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/** How one repository tracks its work, as the tool prints it. Part of the JSON contract. */
export interface ProcessReport {
  repository: string;
  /** `read`: the repository has the file. `missing`: it has none, so the defaults apply. `failed`: it could not be read, so the defaults are shown. */
  file: 'read' | 'missing' | 'failed';
  /** For each section, whether the file set it or it is the default. */
  sources: Record<ProcessSection, SectionSource>;
  process: ProcessConfig;
  /** What is wrong in the file, in the chosen language. */
  issues: { severity: string; code: string; message: string }[];
  /** Why the file could not be read. */
  error?: { code: string; message: string };
}

/** At most this many repositories are asked at a time (DEC-015). */
export const PROCESS_READ_LIMIT = 4;

/**
 * Reads the process of every repository, a few at a time. A repository that has no file or cannot
 * be read shows the defaults and says so, and never stops the others.
 */
export async function readProcesses(token: string, repositories: readonly string[], locale: Locale, fetchFn?: FetchFn): Promise<ProcessReport[]> {
  return mapLimit(repositories, PROCESS_READ_LIMIT, async (repository): Promise<ProcessReport> => {
    const result = await fetchProcessFile(token, repository, {}, fetchFn);
    const defaults = { process: defaultProcess(), sources: { columns: 'default', evidence: 'default', stale: 'default' } as Record<ProcessSection, SectionSource> };

    if (result.status === 'read') {
      const parsed = parseProcess(`${repository}/.weaver/process.yaml`, result.text);
      return {
        repository,
        file: 'read',
        sources: parsed.sources,
        process: parsed.process,
        issues: parsed.issues.map((issue) => ({ severity: issue.severity, code: issue.code, message: t(validationKey(issue.code), locale, issue.args) })),
      };
    }
    if (result.status === 'failed') {
      return { repository, file: 'failed', ...defaults, issues: [], error: { code: result.error.code, message: formatNotice(result.error, locale) } };
    }
    // `unchanged` cannot happen without an ETag; it is treated like a file that has nothing new.
    return { repository, file: 'missing', ...defaults, issues: [] };
  });
}

/** One line per repository, then its problems, for `--text`. */
export function processText(reports: readonly ProcessReport[]): string {
  const lines: string[] = [];
  for (const r of reports) {
    const sources = (['columns', 'evidence', 'stale'] as const).map((section) => `${section}=${r.sources[section]}`).join(' ');
    lines.push(`${r.repository}\t${r.file}\t${sources}`);
    for (const issue of r.issues) lines.push(`  ${issue.severity}: ${issue.message}`);
    if (r.error) lines.push(`  error: ${r.error.message}`);
  }
  return lines.length ? `${lines.join('\n')}\n` : '';
}
