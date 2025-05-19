import supportsColor from "supports-color";
import { Journal } from "../core/data/journal.ts";
import { DateFormat } from "../core/reports/dateFormat.ts";
import { AmountDisplayPolicy } from "../render/amount.ts";
import { RenderFormat } from "../render/renderable.ts";
import { LINE_ENDING } from "../core/parsing/journal/inputStreamJournalReader.ts";
import { EOL } from "os";
import { execSync } from "child_process";

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
    return {
      target: "ascii",
      colorSpace: supportsColor.stdout ?
        supportsColor.stdout.has16m ?
          'rgb' :
          supportsColor.stdout.has256 ? 256 : 16
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
    if (!this._console_buffer.length) return;

    const content = this._console_buffer.join("");

    const cmd = this._console_buffer_lines >= process.stdout.rows ? this.pipeCmdLong : this.pipeCmdShort;

    try {
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