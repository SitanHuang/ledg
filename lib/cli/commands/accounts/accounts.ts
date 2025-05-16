import { MultiperiodTreeAggregator, QueryEngine } from "../../../core/reports/namespace.ts";
import { hasResult, isOk, Maybe, Ok, unwrapResult } from "../../../core/types.ts";
import { parseSmartDate } from "../../../core/utils/dateUtils.ts";
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

  constructor() {
    super("accounts", "Show account balances.")
  }

  override build(): void {
    super.build();

    this.fromOption.defaultValue = unwrapResult(parseSmartDate('today midnight'));
    this.toOption.defaultValue = unwrapResult(parseSmartDate('tomorrow midnight'));
    this.cumulativeOption.defaultValue = true;

    this.removeOption(this.periodDayOption);
    this.removeOption(this.periodMonthOption);
    this.removeOption(this.periodYearOption);
    this.removeOption(this.singlePeriodOption);

    this.setOption(this.sumOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.sumOption.extractValue(option, value, (v: boolean) => {
      this.sumOptionValue = v;
    });

    return Ok;
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

    const rootItem = new MultiperiodTreeAggregator(
      context.journal,
      QueryEngine
        .create(this.getReportPolicy().withSingleReportPeriod())
        .compile(),
      this.getReportPolicy()
    ).execute();

    if (!hasResult(rootItem)) {
      return rootItem;
    }

    const table = new Table({
      justify: ["left", "right"]
    });
    table.addRow(["Accounts", "Balance"], { header: true });

    const renderer = new MultiperiodTreeRenderer(context.amountDisplayPolicy);

    renderer.renderBalances(rootItem, table);

    if (this.sumOptionValue) {
      renderer.renderSum(rootItem, table);
    }

    console.log(table.render(context.renderFormat));

    return Ok;
  }
}