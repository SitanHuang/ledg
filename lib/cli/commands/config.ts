import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isOk, Maybe, Ok, Result } from "../../core/types.ts";
import { ArgParseError, Positionals } from "../argparse/argparse.ts";
import { Command } from "../argparse/command.ts";
import { ConfigParser } from "../argparse/configparser.ts";
import { Option, OptionValue } from "../argparse/option.ts";
import { DEBUG } from "../entry.ts";

export abstract class ConfigurableCommand extends Command {

  protected inputFile?: string;

  protected readonly fileOption = new Option({
    name: "file",
    alias: "F",
    type: "string",
    required: false,
    description: "Ledg book entry file, or '-' to read from STDIN.",
  });
  protected readonly noConfigOption = new Option({
    name: "no-config",
    type: "boolean",
    required: false,
    description: "Disables the reading of ANY .ledg2rc files.",
    longDescription: [
      "Controls the loading of configuration files (.ledg2rc).",
      "",
      "By default (without --no-config), configuration files are loaded and merged in this order:",
      "",
      "  1. ~/.ledg2rc (global user config)",
      "  2. ./.ledg2rc (from current working directory)",
      "  3. .ledg2rc located in the same directory as the ledger file specified via --file. The command line argument `--file` takes precedence over the `file` options in the previous two items.",
      "",
      "Each configuration file follows INI-style syntax:",
      "",
      "  - Key-value pairs: key=value",
      "  - Subcommand sections: [subcommand]",
      "  - Comments start with #, //, or ;",
      "  - Values can be raw strings or JSON strings enclosed in double quotes",
      "  - Keys must use long CLI option names",
      "  Example:",
      "    ```ini",
      "    file        = /home/user/Documents/book.ledg2",
      "    light-theme = true",
      "    ",
      "    hide-zero   = true",
      "    ",
      "    tree        = true",
      "    ",
      "    [cashflow]",
      "    ",
      "    tree=false",
      "    ```",
      "",
      "When the --no-config option is provided, loading and processing of all .ledg2rc files is completely disabled.",
    ].join("\n")
  });

  override build(): void {
    super.build();

    this.inputFile = undefined;

    this.setOption(this.fileOption);
    this.setOption(this.noConfigOption);
  }

  override exec(argv: readonly string[]): Result<Positionals, ArgParseError> {
    if (extractNoConfig(argv)) {
      return super.exec(argv);
    }

    const configParser = new ConfigParser();

    if (this.env.HOME) {
      const homePath = resolve(this.env.HOME, './.ledg2rc');
      if (DEBUG) console.debug(`Trying home config file "${homePath}"`);

      if (statSync(homePath, { throwIfNoEntry: false })?.isFile()) {
        if (DEBUG) console.debug(`Read home config file "${homePath}"`);
        const result = configParser.load(homePath);
        if (!isOk(result)) {
          const error = new ArgParseError(`Error while reading config file "${homePath}".`);
          error.cause = result;
          return error;
        }
        this.inputFile = configParser.getConfigGroup(this.name).get("file") ?? this.inputFile;
      }
    }

    if (this.cwd !== this.env.HOME) {
      const homePath = resolve(this.cwd, './.ledg2rc');
      if (DEBUG) console.debug(`Trying cwd config file "${homePath}"`);

      if (statSync(homePath, { throwIfNoEntry: false })?.isFile()) {
        if (DEBUG) console.debug(`Read cwd config file "${homePath}"`);
        const result = configParser.load(homePath);
        if (!isOk(result)) {
          const error = new ArgParseError(`Error while reading config file "${homePath}".`);
          error.cause = result;
          return error;
        }
        this.inputFile = configParser.getConfigGroup(this.name).get("file") ?? this.inputFile;
      }
    }

    // if process.argv specified the book file, load .ledgrc of that directory
    // otherwise, load .ledgrc of the book directory specified by ~/.ledgrc args
    const extractedFileOpt =
      extractFileOpt(argv) ?? // <- argv
      configParser.getConfigGroup(this.name).get("file") ?? // <- ~/.ledgrc
      this.inputFile;

    if (extractedFileOpt) {
      const fileConfig = resolve(dirname(extractedFileOpt), './.ledg2rc');

      if (DEBUG) console.debug(`Trying --file config file "${fileConfig}"`);

      if (statSync(fileConfig, { throwIfNoEntry: false })?.isFile()) {
        if (DEBUG) console.debug(`Read --file config file "${fileConfig}"`);
        const result = configParser.load(fileConfig);
        if (!isOk(result)) {
          const error = new ArgParseError(`Error while reading config file "${fileConfig}".`);
          error.cause = result;
          return error;
        }
      }
    }

    // Use subcommand-specific configs
    const entries = configParser.walkEntries(this.name);

    const configArgs: string[] = [];

    for (const [key, val] of entries) {
      const opt = this.getLongOptions().get(key);

      if (!opt) {
        return new ArgParseError(`Config file contains an unrecognized long option name "--${key}"`);
      }

      // Must use = so that the "true" sticks with the flag because boolean
      // options don't parse with lookaheads.
      configArgs.push(`--${key}=${val}`);
    }

    return super.exec(configArgs.concat(argv));
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    this.inputFile = this.fileOption.extractValue(option, value) ?? this.inputFile;
    return Ok;
  }
}

function extractFileOpt(argv: readonly string[]): string | undefined {
  for (let i = 0, a; (a = argv[i++]) && a != "--";) {
    if (a == "--file" || a == "-F") {
      return argv[i];
    } else if (a.startsWith("--file=")) {
      return a.slice(7);
    }
  }
}
function extractNoConfig(argv: readonly string[]): boolean {
  let flag = false;
  for (let i = 0, a; (a = argv[i++]) && a != "--";) {
    if (a == "--no-config" || a == "--no-config=true") {
      flag = true;
    } else if (a == '--no-config=false') {
      flag = false; // overriding
    }
  }
  return flag;
}