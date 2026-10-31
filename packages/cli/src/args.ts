export interface Args {
  command?: string;
  positional: string[];
  options: Record<string, string>;
  flags: Set<string>;
}

const VALUE_OPTIONS = new Set(['root', 'repository', 'column', 'lang']);
const FLAGS = new Set(['text', 'help']);

/** `--name value` for options, `--name` for flags. Anything else is a positional word. */
export function parseArgs(argv: readonly string[]): Args | { unknown: string } {
  const args: Args = { positional: [], options: {}, flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i];
    if (!word.startsWith('--')) {
      args.positional.push(word);
      continue;
    }
    const name = word.slice(2);
    if (FLAGS.has(name)) args.flags.add(name);
    else if (VALUE_OPTIONS.has(name) && i + 1 < argv.length) args.options[name] = argv[++i];
    else return { unknown: word };
  }
  args.command = args.positional.shift();
  return args;
}
