import { spawnSync } from "child_process";
import { Maybe, Ok, Result } from "../../../core/types.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option } from "../../argparse/option.ts";
import { DEBUG } from "../../entry.ts";
import { LedgCommand } from "../ledg.ts";

export class GitCommand extends LedgCommand {
  constructor() {
    super(
      "git",
      "Passthrough command for executing git in the directory of the input file.",
      "<git arguments passthrough>"
    );
  }

  override build(): void {
    super.build();

    const keep = [
      this.helpOption,
      this.fileOption,
      this.noConfigOption,
      this.debugOption,
    ];

    for (const key in this) {
      const val = this[key];

      if (val instanceof Option && !keep.includes(val)) {
        this.removeOption(val);
      }
    }
  }

  override exec(argv: readonly string[]): Result<Positionals, ArgParseError> {
    const sentinelIdx = argv.indexOf("--");
    const unescaped = argv.slice(0, sentinelIdx == -1 ? undefined : sentinelIdx);

    if (unescaped.includes('--help') || unescaped.includes('-h')) {
      return super.exec(argv);
    }

    return super.exec(['--'].concat(argv.slice(argv.indexOf('git') + 1)));
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    if (DEBUG) {
      console.debug(JSON.stringify(positionals));
      console.debug(this.getBookCwd());
    }

    const result = spawnSync(
      "git",
      positionals.map(x => x.raw),
      {
        cwd: this.getBookCwd(),
        env: this.env,
        stdio: 'inherit',
      }
    );

    return result.error ?? Ok;
  }
}