import { execSync } from "child_process";
import { createInterface } from "node:readline/promises";
import { EOL } from "os";
import { Journal } from "../core/data/journal.ts";
import { LINE_ENDING } from "../core/parsing/journal/inputStreamJournalReader.ts";
import { DateFormat } from "../core/reports/dateFormat.ts";
import { AmountDisplayPolicy } from "../render/amount.ts";
import { Renderable, RenderFormat } from "../render/renderable.ts";

export class ExitCode extends Error {
  private readonly __exitCodeBrand = undefined;

  constructor(
    public readonly exitCode: number
  ) { super(); }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace LedgCLIContext {
  export interface PromptLineOptions {
    outputReplacer?: (answer: string) => string | Renderable,
    validator?: (answer: string) => boolean,
  }
};

export class LedgCLIContext {

  public renderFormat: RenderFormat = LedgCLIContext.getCLIRenderFormat();

  public amountDisplayPolicy: AmountDisplayPolicy;
  public dateFormat = new DateFormat();

  private constructor(
    public journal = Journal.create()
  ) {
    this.amountDisplayPolicy = new AmountDisplayPolicy(journal.currencyProvider);
  }

  private static currentContext = new LedgCLIContext();

  public static getCurrentContext(): LedgCLIContext {
    return LedgCLIContext.currentContext;
  }

  public static getCLIRenderFormat(): Extract<RenderFormat, { target: "ascii" }> {
    /*
    1 for 2,
    4 for 16,
    8 for 256,
    24 for 16,777,216 colors supported.
    */
    const depth = process.stdout.getColorDepth();
    return {
      target: "ascii",
      colorSpace: depth >= 4 ?
        depth >= 24 ?
          'rgb' :
          depth >= 8 ? 256 : 16
        : 16
    }
  }

  get lineDelimiter(): LINE_ENDING {
    return EOL as LINE_ENDING;
  }

  private readonly _old_console_log: typeof console.log = console.log;
  private _console_buffer: string[] = [];
  private _console_buffer_lines = 0;

  private pipeCmdLong?: string;
  private pipeCmdShort?: string;

  async promptLine(prompt: string, opts?: LedgCLIContext.PromptLineOptions) {
    const useOpts: LedgCLIContext.PromptLineOptions = Object.assign({}, opts);

    process.stdout.write(prompt);

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
      while (true) {
        const answer = await rl.question(prompt);

        if (useOpts.validator && !(useOpts.validator(answer))) {
          process.stdout.write('\x1b[1A');
          continue;
        }

        if (useOpts.outputReplacer) {
          const replaced = useOpts.outputReplacer(answer);
          process.stdout.write('\x1b[1A' + prompt);
          process.stdout.write(
            replaced instanceof Renderable ?
              replaced.render(this.renderFormat) :
              replaced
          );
          process.stdout.write('\n');
        }

        return answer;
      }
    } finally {
      rl.close();
    }
  }

  printlnRenderable(renderable: Renderable, method: 'log' | 'error' | 'debug' = 'log') {
    console[method](renderable.render(this.renderFormat));
  }

  pipeConsoleBuffer(
    longCmd?: string,
    shortCmd?: string,
  ) {
    this.pipeCmdLong = longCmd;
    this.pipeCmdShort = shortCmd;

    if (process.stdout.isTTY) {
      console.log = (...strs) => {
        const str = strs.join(" ");
        this._console_buffer.push(str, "\n");
        this._console_buffer_lines += (str.match(/\r\n|\r|\n/g) ?? []).length + 1;
      };
    }

    if (!longCmd && !shortCmd) {
      this.releaseConsoleBuffer(true);
    }
  }

  releaseConsoleBuffer(skipCommand = false) {
    try {
      if (!this._console_buffer.length) return;

      const content = this._console_buffer.join("");

      const cmd = this._console_buffer_lines >= process.stdout.rows ? this.pipeCmdLong : this.pipeCmdShort;

      if (skipCommand || (!this.pipeCmdLong && !this.pipeCmdShort) || (!cmd)) {
        process.stdout.write(content);
      } else {
        execSync(
          cmd, {
          input: this._console_buffer.join(""),
          stdio: ['pipe', process.stdout, process.stderr]
        });
      }
    } finally {
      this._console_buffer.length = 0;
      this._console_buffer_lines = 0;
      console.log = this._old_console_log;
    }
  }

}