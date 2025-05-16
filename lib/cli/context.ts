import { RenderFormat } from "../render/renderable.ts";
import { Journal } from "../core/data/journal.ts";
import { AmountDisplayPolicy } from "../render/amount.ts";
import supportsColor from "supports-color";

export class LedgCLIContext {

  public renderFormat: RenderFormat = LedgCLIContext.getCLIRenderFormat();

  public amountDisplayPolicy: AmountDisplayPolicy;

  constructor(
    public journal: Journal
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
}