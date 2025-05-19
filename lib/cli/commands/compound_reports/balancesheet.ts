import { Rational } from "../../../core/math/rational.ts";
import { CompoundReport, CompoundSubReport } from "../../../core/reports/compoundReport.ts";
import { hasResult, isOk, Maybe, Ok } from "../../../core/types.ts";
import { Positionals } from "../../argparse/argparse.ts";
import { CompoundReportCommand } from "./compound.ts";

export class BalancesheetCommand extends CompoundReportCommand {
  constructor() {
    super("balancesheet", "Produce an balance sheet report.");
  }

  override build(): void {
    super.build();

    this.cumulativeOption.defaultValue = true;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const result = await super.run(positionals);
    if (!isOk(result)) {
      return result;
    }

    const context = await this.getCLIContext();
    if (!hasResult(context)) {
      return context;
    }

    const { journal } = context;

    const report = new CompoundReport({
      title: "Balance Sheet",
      positiveIsGreen: true,
      reportPolicy: this.reportPolicy,
      subreports: [
        new CompoundSubReport({
          title: 'Assets',
          account: this.assetAccPattern,
          invert: false,
          positiveIsGreen: true,
          showPlus: false,
          netMultiplier: Rational.ONE,
        }),
        new CompoundSubReport({
          title: 'Liabilities',
          account: this.liabilityAccPattern,
          invert: true,
          positiveIsGreen: false,
          showPlus: false,
          netMultiplier: Rational.NEGATIVE_ONE,
        }),
      ],
      showPlus: false,
      journal
    });

    this.renderReport(context, report);

    return Ok;
  }
}