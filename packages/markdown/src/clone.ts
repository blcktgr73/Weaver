/** What is under a directory of the fabric root: a Git repository, or something else. */
export type DirectoryKind = 'repository' | 'other';

export interface CloneItem {
  /** `owner/name`. */
  repository: string;
  /** Folder name under the fabric root. */
  directory: string;
  /** `missing` is the only state that gets cloned. Nothing that exists is ever overwritten. */
  state: 'missing' | 'present' | 'not-a-repository';
}

/**
 * Folder names for the registered repositories: the repository name, or `owner-name` when
 * two registered repositories would share one name (names compare without case).
 */
export function cloneDirectories(repositories: readonly string[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    const key = repository.split('/')[1].toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const directories = new Map<string, string>();
  for (const repository of repositories) {
    const [owner, name] = repository.split('/');
    // A name made only of dots would point at the fabric root or its parent.
    const plain = (counts.get(name.toLowerCase()) ?? 0) === 1 && !/^\.+$/.test(name);
    directories.set(repository, plain ? name : `${owner}-${name}`.replace(/^\.+/, '_'));
  }
  return directories;
}

/**
 * Decides, for each registered repository, whether it needs cloning.
 * `present` maps a directory name to what is there; a directory not in the map is missing.
 */
export function planClones(
  repositories: readonly string[],
  present: ReadonlyMap<string, DirectoryKind> | Record<string, DirectoryKind>,
): CloneItem[] {
  const lookup = (directory: string): DirectoryKind | undefined =>
    present instanceof Map ? present.get(directory) : (present as Record<string, DirectoryKind>)[directory];
  const directories = cloneDirectories(repositories);
  return repositories.map((repository) => {
    const directory = directories.get(repository) as string;
    const found = lookup(directory);
    return { repository, directory, state: found === undefined ? 'missing' : found === 'repository' ? 'present' : 'not-a-repository' };
  });
}

/** The address a repository is cloned from. */
export function cloneUrl(repository: string): string {
  return `https://github.com/${repository}.git`;
}
