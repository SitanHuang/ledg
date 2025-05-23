import { ReportPolicy } from "../../../core/reports/reportPolicy.ts";
import { isOk, Maybe, Ok } from "../../../core/types.ts";
import { ArgParseError } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { ReportCommand } from "../report.ts";

export class SubreportCommand extends ReportCommand {

  protected readonly nameOption = new Option({
    name: "name",
    type: "string",
    required: false,
    description: "Set the name of this subreport."
  });

  public nameVal?: string;

  constructor(
    readonly defaultName: string
  ) {
    super("<subreport>", "Create a multiperiod query inside a multiquery command.");
  }

  inheritPolicy(rootPolicy: ReportPolicy) {
    this.reportPolicy = this.queryPolicy = rootPolicy.copy();
  }

  override build(): void {
    super.build();

    this.setOption(this.nameOption);

    const keep = [
      this.nameOption,
      this.inversionOption,
      this.cumulativeOption,
      this.eopOption,
      this.currencyOption,
      this.valuationStrategyOption,
      this.modifierOption,
      this.accountOption,
      this.pendingOption,
      this.clearedOption,
      this.realOption,
      this.useDateOption,
      this.useDate2Option,
    ];

    for (const key in this) {
      const val = this[key];
      if (val instanceof Option && !keep.includes(val)) {
        this.removeOption(val);
      }
    }
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.nameVal = this.nameOption.extractValue(option, value) ?? this.nameVal;

    return Ok;
  }

  public getReportPolicy(): NamedReportPolicy {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    return new NamedReportPolicy(super.getReportPolicy(), this.nameVal || this.defaultName);
  }
}

export class NamedReportPolicy extends ReportPolicy {
  constructor(
    readonly original: ReportPolicy,
    readonly name: string,
  ) {
    super();
    Object.assign(this, original);
  }
}