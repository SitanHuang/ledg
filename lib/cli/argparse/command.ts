import { hasError, isOk, Maybe, Ok, Result } from "../../core/types.ts";
import { ArgParseError, Positionals, Token } from "./argparse.ts";
import { HelpFormatter } from "./helpFormatter.ts";
import { Option, OptionValue } from "./option.ts";

export abstract class Command {

  protected readonly longOptions = new Map<string, Option>();
  protected readonly shortOptions = new Map<string, string>();
  protected readonly helpOption = new Option({
    name: "help",
    alias: "h",
    type: "boolean",
    description: "Show this help message.",
  });
  protected readonly debugOption = new Option({
    name: "debug",
    type: "boolean",
  });

  constructor(
    public readonly name: string,
    public readonly description: string,
  ) { }

  protected setOption(opt: Option): this {
    if (this.longOptions.has(opt.name)) {
      throw new Error(`Duplicate option name "${opt.name}"`);
    }

    this.longOptions.set(opt.name, opt);

    if (opt.alias) {
      if (this.shortOptions.has(opt.alias)) {
        throw new Error(`Duplicate option alias "${opt.alias}" for "${opt.name}"`);
      }

      this.shortOptions.set(opt.alias, opt.name);
    }

    return this;
  }
  protected removeOption(opt: Option): this {
    this.longOptions.delete(opt.name);
    if (opt.alias) {
      this.shortOptions.delete(opt.alias);
    }

    return this;
  }

  protected clearOptions(): this {
    this.longOptions.clear();
    this.shortOptions.clear();
    return this;
  }

  getLongOptions(): ReadonlyMap<string, Option> {
    return this.longOptions;
  }
  getShortOptions(): ReadonlyMap<string, string> {
    return this.shortOptions;
  }

  build() {
    this.setOption(this.helpOption);
    this.setOption(this.debugOption);
  }

  exec(argv: readonly string[]): Result<Positionals, ArgParseError> {
    const positionals: Token[] = [];

    const userProvidedOptions = new Set<Option>();

    let bypass = false;

    for (let i = 0; i < argv.length; i++) {
      const raw = argv[i];

      if (raw == '--') { bypass = true; continue; }
      if (bypass) { positionals.push(new Token(raw, true)); continue; }

      if (raw.startsWith("--")) {
        // Long form: --name or --name=value
        const eq = raw.indexOf("=");
        const longName = raw.slice(2, eq === -1 ? undefined : eq);
        let opt = this.longOptions.get(longName);

        if (!opt && longName.length > 1) {
          opt = this.longOptions.get(this.shortOptions.get(longName) ?? longName);
        }

        if (!opt) {
          throw new ArgParseError(`Unknown option --${longName}`);
        }

        let val: string | undefined;

        if (eq !== -1) {
          val = raw.slice(eq + 1);
        } else if (opt.type === "boolean") {
          val = "true";
        } else {
          val = argv[i + 1];

          if (val === undefined) {
            throw new ArgParseError(`Option --${longName} expects a value.`);
          }

          ++i; // consume look‑ahead
        }

        const result = this.parseOption(opt, val);
        userProvidedOptions.add(opt);

        if (!isOk(result)) {
          return result;
        }

        continue;
      }

      if (raw.startsWith("-") && raw.length > 1) {
        const chars = raw.slice(1).split("");
        for (let cIdx = 0; cIdx < chars.length; ++cIdx) {
          const ch = chars[cIdx];
          const longName = this.shortOptions.get(ch);
          const opt = longName ? this.longOptions.get(longName) : undefined;
          if (!opt) {
            throw new ArgParseError(`Unknown option -${ch}`);
          }

          let val: string | undefined;
          if (opt.type === "boolean") {
            val = "true";
          } else if (cIdx === chars.length - 1) {
            val = argv[i + 1];

            if (val === undefined) {
              throw new ArgParseError(`Option -${ch} expects a value.`);
            }

            ++i;
          } else {
            throw new ArgParseError(`Option -${ch} must be last in cluster as it expects a value.`);
          }

          const result = this.parseOption(opt, val);
          userProvidedOptions.add(opt);

          if (!isOk(result)) {
            return result;
          }
        }
        continue;
      }

      positionals.push(new Token(raw));
    }

    // Inject defaults for missing options
    for (const opt of this.longOptions.values()) {
      if (!userProvidedOptions.has(opt)) {
        if (opt.defaultValue !== undefined) {
          const result = this.consumeOption(opt, opt.defaultValue);
          if (!isOk(result)) {
            return result;
          }
        } else if (opt.required) {
          return new ArgParseError(`Option --${opt.name} is required.`)
        }
      }
    }

    return positionals;
  }

  private parseOption(option: Option, val: string): Maybe<ArgParseError> {
    const result = option.parse(val);

    if (hasError(result)) {
      return result;
    }

    if (option === this.helpOption) {
      this.help();
      return new ArgParseError("Help requested.");
    }

    const err = this.consumeOption(option, result);

    if (!isOk(err)) {
      return err;
    }

    return Ok;
  }

  protected help() {
    console.log(HelpFormatter.format(this));
  }

  protected abstract consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError>;

  abstract run(positionals: Positionals): Promise<Maybe>;
}

export abstract class ExtensibleCommand extends Command {
  protected readonly subcommandAliases = new Map<string, string>();
  protected readonly subcommands = new Map<string, Command>();

  setSubcommand(name: string, aliases: string[], subcommand: Command): this {
    this.subcommands.set(name, subcommand);

    aliases.forEach(alias => {
      this.subcommandAliases.set(alias, name);
    });

    return this;
  }

  getSubcommands(): ReadonlyMap<string, Command>{
    return this.subcommands;
  }
  getAliasesForSubcommand(longCommand: string): readonly string[]{
    return [...this.subcommandAliases.entries().filter(([, long]) => long === longCommand).map(x => x[0])];
  }

  protected detectedSubcommand?: Command;
  protected defaultSubcommand?: Command;

  build(): this {
    super.build();

    for (const command of this.subcommands.values()) {
      command.build();
    }

    return this;
  }

  override exec(argv: readonly string[]): Result<Positionals, ArgParseError> {
    this.detectedSubcommand = undefined;

    const sentinelIdx = argv.indexOf("--");

    type Candidate = [string, number];

    const relevantTokens = (sentinelIdx >= 0 ? argv.slice(0, sentinelIdx) : argv)
                             .map((x, idx) => [x, idx] as Candidate)
                             .filter(([arg, ]) => !arg.startsWith("-"));

    // Options, depending on type, may or may not consume adjacent positionals
    // as values. We can't know unless we know the subcommand class, so this
    // becomes a chicken-and-egg problem. We can only take our best guess...
    const candidateScore = (positional: string, pos: number) => {
      // Boost the candidates that look like subcommands

      return (this.subcommands.has(positional) ? 2 : 0) + // exact match
             (this.subcommandAliases.has(positional) ? 1 : 0) + // alias match
             (-pos / relevantTokens.length) + // earlier in the argv, the better
             ((/[^a-z]/i.exec(positional)) ? -1 : 0); // penalty for non-letter chars
    };

    const subcommandCandidates = relevantTokens.sort((a, b) => {
      return candidateScore(...b) - candidateScore(...a); // highest score goes first
    });

    for (const [positional, pos] of subcommandCandidates) {
      const name = this.subcommandAliases.get(positional) ?? positional;
      const sub = this.detectedSubcommand = this.subcommands.get(name);

      if (sub) {
        // delegate everything after the sub-command name
        return sub.exec(argv.toSpliced(pos, 1));
      }
    }

    if (this.defaultSubcommand && !argv.find(arg => !!(arg.startsWith("--help") || arg === "-h"))) {
      return this.defaultSubcommand.exec(argv);
    }

    // no sub-command matched -> fall back to normal parsing
    return super.exec(argv);
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    if (this.detectedSubcommand) {
      return this.detectedSubcommand.run(positionals);
    }

    return this.runDefault(positionals);
  }

  consumeOption(): Maybe<ArgParseError> {
    return Ok;
  }

  async runDefault(positionals: Positionals): Promise<Maybe> {
    return this.defaultSubcommand ?
      await this.defaultSubcommand.run(positionals) :
      new ArgParseError(`"${this.name}" requires a valid subcommand.`);
  }
}