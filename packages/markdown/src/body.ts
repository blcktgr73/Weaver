import { Criterion, TaskRef } from './types';

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Top-level list items under the `##` section with the given title. */
export function sectionItems(body: string, title: string): string[] | undefined {
  const lines = body.split(/\r?\n/);
  const wanted = title.trim().toLowerCase();
  let inSection = false;
  let found = false;
  const items: string[] = [];

  for (const line of lines) {
    const heading = HEADING.exec(line);
    if (heading && heading[1].length <= 2) {
      inSection = heading[1].length === 2 && heading[2].trim().toLowerCase() === wanted;
      found = found || inSection;
      continue;
    }
    if (!inSection) continue;
    const item = /^[-*]\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/.exec(line);
    if (item) items.push(item[1]);
  }
  return found ? items : undefined;
}

export function parseCriteria(body: string): Criterion[] {
  const items = sectionItems(body, 'Acceptance criteria') ?? [];
  return items.map((text, index) => ({
    id: `AC-${String(index + 1).padStart(3, '0')}`,
    text,
  }));
}

const TASK_ITEM = /^`(TASK-\d{3,})`\s+(.*?)(?:\s+[—–-]\s+\[[^\]]*\]\((https?:\/\/[^)\s]+)\))?\s*$/;

export interface ParsedTasks {
  tasks: TaskRef[];
  malformed: string[];
}

export function parseTasks(body: string): ParsedTasks {
  const items = sectionItems(body, 'Tasks') ?? [];
  const tasks: TaskRef[] = [];
  const malformed: string[] = [];

  for (const item of items) {
    const match = TASK_ITEM.exec(item);
    if (!match) {
      malformed.push(item);
      continue;
    }
    const [, id, title, issueUrl] = match;
    const number = issueUrl ? /\/issues\/(\d+)/.exec(issueUrl)?.[1] : undefined;
    tasks.push({
      id,
      title: title.trim(),
      ...(issueUrl ? { issueUrl } : {}),
      ...(number ? { issueNumber: Number(number) } : {}),
    });
  }
  return { tasks, malformed };
}
