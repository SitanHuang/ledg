import { CompoundReport } from "../../../core/reports/compoundReport.ts";
import { hasResult, isOk, Maybe, Ok, unwrapResult } from "../../../core/types.ts";
import { parseSmartDate } from "../../../core/utils/dateUtils.ts";
import { CompoundTreeRenderer } from "../../../render/compoundReport.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { LedgCLIContext } from "../../context.ts";
import { DEBUG } from "../../entry.ts";
import { ReportCommand } from "../report.ts";

export abstract class CompoundCommand extends ReportCommand {

  protected readonly incomeAccOption = new Option({
    name: "income",
    type: "string",
    defaultValue: "\\v^income",
    description: "Glob pattern for income accounts. See --account for more.",
  });
  protected incomeAccPattern = "\\v^income";

  protected readonly expenseAccOption = new Option({
    name: "expense",
    type: "string",
    defaultValue: "\\v^expense",
    description: "Glob pattern for expense accounts. See --account for more.",
  });
  protected expenseAccPattern = "\\v^expense";

  protected readonly assetAccOption = new Option({
    name: "asset",
    type: "string",
    defaultValue: "\\v^asset",
    description: "Glob pattern for asset accounts. See --account for more.",
  });
  protected assetAccPattern = "\\v^asset";

  protected readonly liabilityAccOption = new Option({
    name: "liability",
    type: "string",
    defaultValue: "\\v^liability",
    description: "Glob pattern for liability accounts. See --account for more.",
  });
  protected liabilityAccPattern = "\\v^liability";

  protected readonly equityAccOption = new Option({
    name: "equity",
    type: "string",
    defaultValue: "\\v^equity",
    description: "Glob pattern for equity accounts. See --account for more.",
  });
  protected equityAccPattern = "\\v^equity";

  // TODO: avg

  override build(): void {
    super.build();

    this.fromOption.required = false;
    this.fromOption.defaultValue = unwrapResult(parseSmartDate('this year midnight'));
    this.fromOption.defaultValueDisplay = "this year midnight";
    this.toOption.required = false;

    const thisMonthMidnight = new Date(unwrapResult(parseSmartDate('this month midnight')));
    thisMonthMidnight.setUTCMonth(thisMonthMidnight.getUTCMonth() + 1);

    this.toOption.defaultValue = thisMonthMidnight.getTime();
    this.toOption.defaultValueDisplay = "next month midnight";

    this.reportPolicy.withReportPeriodInterval(0, 1, 0);

    this.setOption(this.incomeAccOption);
    this.setOption(this.expenseAccOption);
    this.setOption(this.assetAccOption);
    this.setOption(this.liabilityAccOption);
    this.setOption(this.equityAccOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.incomeAccOption.extractValue(option, value, acc => {
      this.incomeAccPattern = acc;
    });
    this.expenseAccOption.extractValue(option, value, acc => {
      this.expenseAccPattern = acc;
    });
    this.assetAccOption.extractValue(option, value, acc => {
      this.assetAccPattern = acc;
    });
    this.liabilityAccOption.extractValue(option, value, acc => {
      this.liabilityAccPattern = acc;
    });
    this.equityAccOption.extractValue(option, value, acc => {
      this.equityAccPattern = acc;
    });

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const result = await super.run(positionals);
    if (!isOk(result)) {
      return result;
    }

    const policy = this.getReportPolicy();

    if (DEBUG) {
      policy.periods();
      console.debug(policy);
    }

    return Ok;
  }

  protected renderReport(context: LedgCLIContext, report: CompoundReport): Maybe {
    const result = report.execute();

    if (!hasResult(result)) {
      return result;
    }

    console.log(
      new CompoundTreeRenderer(
        report,
        context.amountDisplayPolicy,
        context.dateFormat
      ).render(result).render(context.renderFormat)
    );

    return Ok;
  }
}