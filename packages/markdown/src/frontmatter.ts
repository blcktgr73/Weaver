/** A value as it is written in YAML: plain when it is safe, otherwise quoted. */
export function yamlValue(value: string): string {
  return /^[\w][\w .@-]*$/.test(value) && !/\s$/.test(value) ? value : JSON.stringify(value);
}

/**
 * Sets or removes single-line fields in the frontmatter of a Markdown file and leaves everything
 * else as it is: the other fields, their order, the body, and the line endings. A field that is
 * not there yet is added at the end. `null` removes a field.
 *
 * Returns undefined when the file has no frontmatter, or when a field to change is written over
 * several lines (a block value), which this does not try to rewrite.
 */
export function setFrontmatterFields(text: string, fields: Record<string, string | null>): string | undefined {
  const match = /^(﻿?---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/.exec(text);
  if (!match) return undefined;
  const eol = match[2].includes('\r\n') || match[1].includes('\r\n') ? '\r\n' : '\n';
  const lines = match[2].split(/\r?\n/);

  for (const [key, value] of Object.entries(fields)) {
    const at = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (at >= 0 && /^[ \t-]/.test(lines[at + 1] ?? '')) return undefined; // a block value
    if (value === null) {
      if (at >= 0) lines.splice(at, 1);
    } else if (at >= 0) {
      lines[at] = `${key}: ${value}`;
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return match[1] + lines.join(eol) + match[3] + text.slice(match[0].length);
}
