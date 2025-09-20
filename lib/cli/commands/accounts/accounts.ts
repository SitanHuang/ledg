import { DEBUG } from "../../context.ts";
import { MultiperiodTreeAggregator, QueryEngine } from "../../../core/reports/namespace.ts";
import { hasResult, isOk, Maybe, Ok } from "../../../core/types.ts";
import { MultiperiodTreeRenderer } from "../../../render/multiperiodTree.ts";
import { Table } from "../../../render/table.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { ReportCommand } from "../report.ts";

export class AccountsCommand extends ReportCommand {
  protected readonly sumOption = new Option({
    name: "sum",
    type: "boolean",
    defaultValue: false,
    description: "Prints out a line of total sum at the end.",
  });

  protected sumOptionValue = false;

  protected readonly percOption = new Option({
    name: "percent",
    alias: "%",
    type: "boolean",
    defaultValue: false,
    description: "Display values as percentages of each subreport's total.",
  });
  protected percOptionValue = false;

  constructor() {
    super("accounts", "Show account balances.")
  }

  override build(): void {
    super.build();

    this.fromOption.required = false;
    this.fromOption.defaultValueDisplay = "-inf";
    this.fromOption.defaultValue = undefined;
    this.toOption.required = false;
    this.toOption.defaultValue = undefined;
    this.toOption.defaultValueDisplay = "inf";

    this.removeOption(this.periodDayOption);
    this.removeOption(this.periodMonthOption);
    this.removeOption(this.periodYearOption);
    this.removeOption(this.singlePeriodOption);
    this.removeOption(this.dailyOption);
    this.removeOption(this.weeklyOption);
    this.removeOption(this.monthlyOption);
    this.removeOption(this.yearlyOption);
    this.removeOption(this.quaterlyOption);
    this.removeOption(this.cumulativeOption);

    this.setOption(this.sumOption);
    this.setOption(this.percOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.sumOption.extractValue(option, value, (v: boolean) => {
      this.sumOptionValue = v;
    });

    this.percOptionValue = this.percOption.extractValue(option, value) ?? this.percOptionValue;

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const result = await super.run(positionals);
    if (!isOk(result)) {
      return result;
    }

    const policy = this.getReportPolicy()
      .withSingleReportPeriod();

    if (DEBUG) {
      policy.periods();
      console.debug(policy);
    }

    const context = await this.getCLIContext();
    if (!hasResult(context)) {
      return context;
    }

    const { journal } = context;

    const rootItem = new MultiperiodTreeAggregator(
      journal,
      QueryEngine
        .create(policy)
        .compile(),
      policy
    ).execute();

    if (!hasResult(rootItem)) {
      return rootItem;
    }

    const table = new Table({
      justify: ["left", "right"]
    });
    table.addRow(["Accounts", "Balance"], { header: true });

    const renderer = new MultiperiodTreeRenderer(context.amountDisplayPolicy);

    const output = renderer.renderBalances(rootItem, table, false, this.percOptionValue);

    if (!isOk(output)) {
      return output;
    }

    if (this.sumOptionValue) {
      renderer.renderSum(rootItem, table);
    }

    context.printlnRenderable(table);

    return Ok;
  }
}