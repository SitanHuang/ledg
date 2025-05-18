import { Rational } from "../../../core/math/rational.ts";
import { CompoundReport, CompoundSubReport } from "../../../core/reports/compoundReport.ts";
import { hasResult, isOk, Maybe, Ok } from "../../../core/types.ts";
import { Positionals } from "../../argparse/argparse.ts";
import { CompoundCommand } from "./compound.ts";

export class IncomestatementCommand extends CompoundCommand {
  constructor() {
    super("incomestatement", "Produce an income statement report.");
  }

  override build(): void {
    super.build();

    this.cumulativeOption.defaultValue = false;
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
      title: "Income Statement",
      positiveIsGreen: true,
      reportPolicy: this.reportPolicy,
      subreports: [
        new CompoundSubReport({
          title: 'Income',
          account: this.incomeAccPattern,
          invert: true,
          positiveIsGreen: true,
          showPlus: true,
          netMultiplier: Rational.ONE,
        }),
        new CompoundSubReport({
          title: 'Expenses',
          account: this.expenseAccPattern,
          invert: false,
          positiveIsGreen: false,
          showPlus: false,
          netMultiplier: Rational.NEGATIVE_ONE,
        }),
      ],
      showPlus: true,
      journal
    });

    this.renderReport(context, report);

    return Ok;
  }
}