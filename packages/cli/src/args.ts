export interface Args {
  command?: string;
  positional: string[];
  options: Record<string, string>;
  flags: Set<string>;
  /** Options that may be given more than once, in the order given (--field name=value). */
  repeated: Record<string, string[]>;
}

const VALUE_OPTIONS = new Set(['root', 'repository', 'column', 'lang', 'approve', 'title', 'requirement', 'criteria', 'assignee', 'assignee-type', 'area', 'to', 'pull']);
const REPEATED_OPTIONS = new Set(['field']);
const FLAGS = new Set(['text', 'help', 'apply']);

/** `--name value` for options, `--name` for flags. Anything else is a positional word. */
export function parseArgs(argv: readonly string[]): Args | { unknown: string } {
  const args: Args = { positional: [], options: {}, flags: new Set(), repeated: {} };
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (!word.startsWith('--')) {
      args.positional.push(word);
      continue;
    }
    const name = word.slice(2);
    if (FLAGS.has(name)) args.flags.add(name);
    else if (REPEATED_OPTIONS.has(name) && i + 1 < argv.length) (args.repeated[name] ??= []).push(argv[++i]);
    else if (VALUE_OPTIONS.has(name) && i + 1 < argv.length) args.options[name] = argv[++i];
    else return { unknown: word };
  }
  args.command = args.positional.shift();
  return args;
}
