import { Locale, t } from './i18n';
import { CriterionCoverage, MergedTask } from './tasks';

/**
 * What is still open when someone is about to record acceptance: criteria that
 * are not verified, recorded blockers, and tasks waiting for a human decision.
 * Acceptance stays a human decision; this only lists what the person should see.
 */
export function acceptanceGaps(coverage: CriterionCoverage[], tasks: MergedTask[], locale: Locale = 'en'): string[] {
  const lines: string[] = [];
  for (const item of coverage) {
    if (item.state === 'verified') continue;
    lines.push(
      t('acceptance.criterion-open', locale, {
        id: item.criterion.id,
        state: t(`ui.criteria.state.${item.state}`, locale),
      }),
    );
  }
  for (const task of tasks) {
    const blockers = task.file?.blockers ?? [];
    if (blockers.length > 0) lines.push(t('acceptance.blockers', locale, { task: task.id, blockers }));
    if (task.file?.status === 'needs-human-decision') lines.push(t('acceptance.decision', locale, { task: task.id }));
  }
  return lines;
}

function yamlValue(value: string): string {
  return /^[\w][\w .@-]*$/.test(value) && !/\s$/.test(value) ? value : JSON.stringify(value);
}

/**
 * Rewrites a requirement file's frontmatter to record acceptance: `status`
 * becomes `accepted`, and `accepted_by` and `accepted_on` are set. The body and
 * every other field stay as they are. Returns undefined when the file has no
 * frontmatter or no `status` line.
 */
export function recordAcceptance(text: string, by: string, on: string): string | undefined {
  const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(text);
  if (!match) return undefined;
  const eol = match[2].includes('\r\n') || match[1].includes('\r\n') ? '\r\n' : '\n';
  const lines = match[2]
    .split(/\r?\n/)
    .filter((line) => !/^(accepted_by|accepted_on):/.test(line))
    .map((line) => (/^status:/.test(line) ? 'status: accepted' : line));
  if (!lines.some((line) => line === 'status: accepted')) return undefined;
  lines.push('accepted_by: ' + yamlValue(by), 'accepted_on: ' + JSON.stringify(on));
  return match[1] + lines.join(eol) + match[3] + text.slice(match[0].length);
}
