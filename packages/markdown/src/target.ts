import type { Artifact } from './types';

/** What a Markdown file is to Weaver. `none` is ordinary Markdown. */
export type DocumentKind = 'requirement' | 'task' | 'none';

/** The kind of Weaver document at a workspace-relative path, from the parsed artifacts. */
export function documentKindOf(artifacts: Artifact[], path: string): DocumentKind {
  return artifacts.find((artifact) => artifact.path === path)?.kind ?? 'none';
}
