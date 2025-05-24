import { ReportPolicy } from "../../core/reports/reportPolicy.ts";
import { hasResult, isOk, Maybe, Ok, timestamp } from "../../core/types.ts";
import { parseSmartDate } from "../../core/utils/dateUtils.ts";
import { ArgParseError } from "../argparse/argparse.ts";
import { Option, OptionValue } from "../argparse/option.ts";
import { QueryCommand } from "./query.ts";

export abstract class ReportCommand extends QueryCommand {
  protected reportPolicy: ReportPolicy = new ReportPolicy();

  protected readonly periodDayOption = new Option({
    name: "period-days",
    alias: "pd",
    type: "int",
    description: "Day component of report period interval (0 = ignore).",
  });

  protected readonly periodMonthOption = new Option({
    name: "period-months",
    alias: "pm",
    type: "int",
    description: "Month component of report period interval (0 = ignore).",
  });

  protected readonly periodYearOption = new Option({
    name: "period-years",
    alias: "py",
    type: "int",
    description: "Year component of report period interval (0 = ignore).",
  });

  protected readonly dailyOption = new Option({
    name: "daily",
    type: "boolean",
    description: "Set period interval to daily.",
  });
  protected readonly weeklyOption = new Option({
    name: "weekly",
    type: "boolean",
    description: "Set period interval to weekly.",
  });
  protected readonly monthlyOption = new Option({
    name: "monthly",
    type: "boolean",
    description: "Set period interval to monthly.",
  });
  protected readonly quaterlyOption = new Option({
    name: "quaterly",
    type: "boolean",
    description: "Set period interval to quaterly.",
  });
  protected readonly yearlyOption = new Option({
    name: "yearly",
    type: "boolean",
    description: "Set period interval to yearly.",
  });

  protected readonly singlePeriodOption = new Option({
    name: "single-period",
    type: "boolean",
    description: "Treat the entire range as one period bucket.",
  });

  protected readonly currencyOption = new Option({
    name: "currency",
    alias: "c",
    type: "string",
    description: "Valuation currency (e.g., USD, EUR).",
  });

  protected readonly valuationStrategyOption = new Option({
    name: "valuation-strategy",
    alias: "vs",
    type: "string",
    description: "Valuation strategy: eop | txnDate | <datetime>.",
  });

  protected readonly eopOption = new Option({
    name: "eop",
    type: "boolean",
    description: "Shortcut for --valuation-strategy=eop",
  });

  protected readonly cumulativeOption = new Option({
    name: "cumulative",
    alias: "cml",
    type: "boolean",
    description: "Aggregate each period cumulatively.",
  });

  protected readonly sumParentOption = new Option({
    name: "sum-parent",
    alias: "sp",
    type: "boolean",
    description: "Accumulate sub-account totals into parents.",
  });

  protected readonly maxDepthOption = new Option({
    name: "max-depth",
    alias: "dep",
    type: "int",
    description: "Maximum account depth shown (Infinity by default).",
  });

  protected readonly minDepthOption = new Option({
    name: "min-depth",
    alias: "mdep",
    type: "int",
    description: "Minimum account depth of top-level rows (0 by default).",
  });

  protected readonly hideZeroOption = new Option({
    name: "hide-zero",
    alias: "hz",
    type: "boolean",
    description: "Hide rows where all period totals are zero.",
  });

  protected readonly treeOption = new Option({
    name: "tree",
    alias: "tr",
    type: "boolean",
    description: "Render accounts hierarchically (tree view).",
  });

  protected readonly sortStrategyOption = new Option({
    name: "sort",
    alias: "s",
    type: "string",
    description: "Sort strategy: accountId | asc | desc.",
  });

  protected readonly inversionOption = new Option({
    name: "invert",
    alias: "inv",
    type: "boolean",
    description: "Flip the sign of all amounts.",
  });

  private periodDays = 0;
  private periodMonths = 0;
  private periodYears = 0;

  override build(): void {
    super.build();

    // Replace the basic QueryPolicy with a ReportPolicy instance
    this.reportPolicy = new ReportPolicy().withSingleReportPeriod();
    this.queryPolicy = this.reportPolicy; // Preserve compatibility with QueryCommand logic

    // Register additional report-level options
    this.setOption(this.periodDayOption);
    this.setOption(this.periodMonthOption);
    this.setOption(this.periodYearOption);

    this.setOption(this.dailyOption);
    this.setOption(this.weeklyOption);
    this.setOption(this.monthlyOption);
    this.setOption(this.quaterlyOption);
    this.setOption(this.yearlyOption);

    this.setOption(this.singlePeriodOption);
    this.setOption(this.currencyOption);
    this.setOption(this.valuationStrategyOption);
    this.setOption(this.eopOption);
    this.setOption(this.cumulativeOption);
    this.setOption(this.sumParentOption);
    this.setOption(this.maxDepthOption);
    this.setOption(this.minDepthOption);
    this.setOption(this.hideZeroOption);
    this.setOption(this.treeOption);
    this.setOption(this.sortStrategyOption);
    this.setOption(this.inversionOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.reportPolicy.withFrom(undefined).withTo(undefined);

    let error: ArgParseError | undefined;

    this.fromOption.extractValue(option, value, (v: timestamp) => {
      this.reportPolicy.withReportFrom(v);
    });

    this.toOption.extractValue(option, value, (v: timestamp) => {
      this.reportPolicy.withReportTo(v);
    });

    this.periodDayOption.extractValue(option, value, (days: number) => {
      this.periodDays = days;
      this.applyPeriodInterval();
    });

    this.periodMonthOption.extractValue(option, value, (months: number) => {
      this.periodMonths = months;
      this.applyPeriodInterval();
    });

    this.periodYearOption.extractValue(option, value, (years: number) => {
      this.periodYears = years;
      this.applyPeriodInterval();
    });

    this.dailyOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) return;
      this.periodDays = 1;
      this.periodMonths = 0;
      this.periodYears = 0;
      this.applyPeriodInterval();
    });
    this.weeklyOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) return;
      this.periodDays = 7;
      this.periodMonths = 0;
      this.periodYears = 0;
      this.applyPeriodInterval();
    });
    this.monthlyOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) return;
      this.periodDays = 0;
      this.periodMonths = 1;
      this.periodYears = 0;
      this.applyPeriodInterval();
    });
    this.quaterlyOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) return;
      this.periodDays = 0;
      this.periodMonths = 3;
      this.periodYears = 0;
      this.applyPeriodInterval();
    });
    this.yearlyOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) return;
      this.periodDays = 0;
      this.periodMonths = 0;
      this.periodYears = 1;
      this.applyPeriodInterval();
    });

    this.singlePeriodOption.extractValue(option, value, (flag: boolean) => {
      if (flag) {
        this.reportPolicy.withSingleReportPeriod();
      }
    });

    this.currencyOption.extractValue(option, value, (cur: string) => {
      this.reportPolicy.withValuationCurrencyId(cur.trim());
    });

    this.valuationStrategyOption.extractValue(option, value, (strat: string) => {
      if (strat === "eop" || strat === "txnDate") {
        this.reportPolicy.withValuationStrategy(strat);
      } else {
        const result = parseSmartDate(strat);

        if (!hasResult(result)) {
          const error = new ArgParseError(`Option "--${option.name}" expects a valid smart date, "eop", or "txnDate".`);
          error.cause = result;
          return error;
        }

        this.reportPolicy.withValuationStrategy(result);
      }
    });

    this.eopOption.extractValue(option, value, (opt: boolean) => {
      if (!opt) return;
      this.reportPolicy.withValuationStrategy("eop");
    });

    this.cumulativeOption.extractValue(option, value, (flag: boolean) => {
      this.reportPolicy.withCumulative(flag);
    });

    this.sumParentOption.extractValue(option, value, (flag: boolean) => {
      this.reportPolicy.withSumParent(flag);
    });

    this.maxDepthOption.extractValue(option, value, (depth: number) => {
      if (depth < 0) {
        error = new ArgParseError("max-depth must be non-negative");
      } else {
        this.reportPolicy.withMaxDepth(depth);
      }
    });

    this.minDepthOption.extractValue(option, value, (depth: number) => {
      if (depth < 0) {
        error = new ArgParseError("min-depth must be non-negative");
      } else {
        this.reportPolicy.withMinDepth(depth);
      }
    });

    this.hideZeroOption.extractValue(option, value, (flag: boolean) => {
      this.reportPolicy.withHideZero(flag);
    });

    this.treeOption.extractValue(option, value, (flag: boolean) => {
      this.reportPolicy.withTree(flag);
    });

    this.sortStrategyOption.extractValue(option, value, (strat: string) => {
      if (strat !== "accountId" && strat !== "asc" && strat !== "desc") {
        error = new ArgParseError(`Option "--${option.name}" expects "accountId", "asc", or "desc".`);
      } else {
        this.reportPolicy.withSortStrategy(strat);
      }
    });

    this.inversionOption.extractValue(option, value, (flag: boolean) => {
      this.reportPolicy.withInversion(flag);
    });

    return error ?? Ok;
  }


  private applyPeriodInterval(): void {
    this.reportPolicy.withReportPeriodInterval(
      this.periodDays,
      this.periodMonths,
      this.periodYears,
    );
  }

  protected getReportPolicy(): ReportPolicy {
    return this.reportPolicy;
  }
}
