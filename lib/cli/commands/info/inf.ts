import { Transaction } from "../../../core/accounting/transaction.ts";
import { QueryEngine } from "../../../core/reports/query/queryEngine.ts";
import { hasResult, isOk, Maybe, Ok, unwrapResult } from "../../../core/types.ts";
import { parseSmartDate, toUTCDatetimeString } from "../../../core/utils/dateUtils.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { DEBUG } from "../../entry.ts";
import { QueryCommand } from "../query.ts";
import { printTransactions } from "./ascii.ts";

export class InfoCommand extends QueryCommand {
  protected readonly sortOption = new Option({
    name: "sort",
    type: "string",
    defaultValue: "insertion-order",
    description: `Sorts transactions. If using "desc" | "asc", dates to be sorted will follow the --date / --date2 options.`,
    inputStringRegex: /^insertion-order|desc|asc$/,
  });

  protected readonly resolveOption = new Option({
    name: "resolve",
    type: "boolean",
    description: `Instead of outputting the user's amount source text, resolve the numerical amount put to 10 decimal places.` +
      ` When set to false, --ledger is forced to be false.`,
    defaultValueDisplay: "false",
  });

  protected sortOptionValue = "insertion-order";
  protected resolveValue = false;

  constructor() {
    super("info", "Pretty prints transactions.");
  }

  override build(): void {
    super.build();

    this.fromOption.required = false;
    // this.fromOption.defaultValue = thisMonthMidnight.getTime();
    this.fromOption.defaultValueDisplay = "beginning of this month";

    this.toOption.required = false;
    // this.toOption.defaultValue = undefined;
    this.toOption.defaultValueDisplay = "inf";

    this.accountOption.description += " For the Info command, transactions are matched as long as one of the posting accounts match.";

    this.setOption(this.sortOption);
    this.setOption(this.resolveOption);
  }

  private _anyModUsed = false;

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.sortOptionValue = this.sortOption.extractValue(option, value) ?? this.sortOptionValue;

    this.resolveValue = this.resolveOption.extractValue(option, value) ?? this.resolveValue;

    if (this.queryOptions.includes(option)) {
      this._anyModUsed = true;
    }

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

    const policy = this.getQueryPolicy();

    if (!this._anyModUsed) {
      console.log(`No modifiers, querying from beginning of this month.\n`);

      const thisMonthMidnight = unwrapResult(parseSmartDate('beginning of this month'));
      policy.from = thisMonthMidnight;
    }

    if (DEBUG) {
      console.debug(policy);
      if (policy.from) console.debug(toUTCDatetimeString(policy.from));
      if (policy.to) console.debug(toUTCDatetimeString(policy.to));
    }

    const { journal } = context;

    const transactions: Transaction[] = [];

    QueryEngine.create(policy).compile().executeTransactionsAndRelated(journal, txn => {
      transactions.push(txn);
    });

    const sortOpt = this.sortOptionValue;

    if (sortOpt !== "insertion-order") {
      transactions.sort((a, b) =>
        sortOpt === "asc" ?
          policy.useLedgObjDate(a) - policy.useLedgObjDate(b) :
          policy.useLedgObjDate(b) - policy.useLedgObjDate(a)
      );
    }

    printTransactions(transactions, !this.resolveValue, context);

    return Ok;
  }
}