import supportsColor from "supports-color";
import { Journal } from "../core/data/journal.ts";
import { DateFormat } from "../core/reports/dateFormat.ts";
import { AmountDisplayPolicy } from "../render/amount.ts";
import { RenderFormat } from "../render/renderable.ts";
import { LINE_ENDING } from "../core/parsing/journal/inputStreamJournalReader.ts";
import { EOL } from "os";

export class LedgCLIContext {

  public renderFormat: RenderFormat = LedgCLIContext.getCLIRenderFormat();

  public amountDisplayPolicy: AmountDisplayPolicy;
  public dateFormat = new DateFormat();

  constructor(
    public journal = Journal.create()
  ) {
    this.amountDisplayPolicy = new AmountDisplayPolicy(journal.currencyProvider);
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
}