import { normalizeIssueUrl } from '@palab/weaver-markdown';
import { addIssueToProject, type Fetch } from '@palab/weaver-github';
import type { PlannedAction } from './actions';

/** An Issue named as `owner/name#number` or by its address. */
export function parseIssueRef(ref: string): { repository: string; number: number; url: string } | undefined {
  const wanted = ref.trim();
  const short = /^([^/\s#]+\/[^/\s#]+)#(\d+)$/.exec(wanted);
  if (short) return { repository: short[1], number: Number(short[2]), url: `https://github.com/${short[1]}/issues/${short[2]}` };
  const address = /^https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)\/?$/i.exec(wanted);
  if (address) return { repository: address[1], number: Number(address[2]), url: `https://github.com/${address[1]}/issues/${address[2]}` };
  return undefined;
}

export type SkipReason = 'invalid' | 'not-registered' | 'already-on-project';

export interface ProjectAddPlan {
  actions: PlannedAction[];
  /** Refs that were left out, and why. */
  skipped: { ref: string; reason: SkipReason }[];
}

export interface ProjectAddInput {
  token: string;
  project: { owner: string; number: number };
  /** The registered repositories, `owner/name`. */
  repositories: readonly string[];
  /** Addresses of the Issues already on the Project. */
  onProject: readonly string[];
  fetch?: Fetch;
}

/**
 * One action per Issue that is in a registered repository and not yet on the Project. An Issue
 * that is not an Issue address, is of another repository, or is already there is left out with
 * its reason, so a run that has nothing to add changes nothing.
 */
export function planProjectAdd(refs: readonly string[], input: ProjectAddInput): ProjectAddPlan {
  const registered = new Set(input.repositories.map((name) => name.toLowerCase()));
  const present = new Set(input.onProject.map(normalizeIssueUrl));
  const seen = new Set<string>();
  const plan: ProjectAddPlan = { actions: [], skipped: [] };

  for (const ref of refs) {
    const issue = parseIssueRef(ref);
    if (!issue) {
      plan.skipped.push({ ref, reason: 'invalid' });
      continue;
    }
    const key = normalizeIssueUrl(issue.url);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!registered.has(issue.repository.toLowerCase())) {
      plan.skipped.push({ ref, reason: 'not-registered' });
    } else if (present.has(key)) {
      plan.skipped.push({ ref, reason: 'already-on-project' });
    } else {
      plan.actions.push({
        kind: 'project.add',
        target: `${issue.repository}#${issue.number}`,
        summary: { code: 'cli.project-add.summary', args: { ref: `${issue.repository}#${issue.number}`, owner: input.project.owner, number: input.project.number } },
        reason: { code: 'cli.project-add.reason' },
        run: () => addIssueToProject(input.token, input.project, issue.url, input.fetch),
      });
    }
  }
  return plan;
}
