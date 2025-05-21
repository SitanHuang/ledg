
import { Amount, getDefault, hasResult, isOk, Maybe, Ok, Posting, QueryEngine, Rational, timestamp, toUTCDatetimeString } from "../../../core/namespace.ts";
import { AmountSpan, Stylable, Table } from "../../../render/namespace.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { DEBUG } from "../../entry.ts";
import { ValuationQueryCommand } from "../valuation_query.ts";

export class RegisterCommand extends ValuationQueryCommand {
  protected readonly skipToOption = new Option({
    name: "skip-to",
    alias: "skip",
    type: "datetime",
    description: "Skip postings before this date but retain the running total.",
  });
  protected skipToVal?: timestamp;

  protected readonly invertOption = new Option({
    name: "invert",
    type: "boolean",
    description: "Invert amounts.",
  });
  protected invertVal = false;

  protected readonly relatedOption = new Option({
    name: "related",
    type: "boolean",
    description: "Show postings' siblings instead.",
  });
  protected relatedVal = false;

  protected readonly uuidOption = new Option({
    name: "show-id",
    alias: "id",
    type: "boolean",
    description: "Show postings' transaction uuid's.",
  });
  protected uuidVal = false;

  protected readonly sortOption = new Option({
    name: "sort",
    type: "string",
    description: `Sorts postings. If using "desc" | "asc", postings will be sorted by amount, and running total will run in the sorted order. If using "date", sorting follows the --date / --date2 options in ascending order.`,
    inputStringRegex: /^date|desc|asc$/,
    defaultValue: "date",
  });
  protected sortVal = "date";

  constructor() {
    super("register", "List postings and their running totals.");
  }

  override build(): void {
    super.build();

    this.setOption(this.skipToOption);
    this.setOption(this.invertOption);
    this.setOption(this.relatedOption);
    this.setOption(this.sortOption);
    this.setOption(this.uuidOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.skipToVal = this.skipToOption.extractValue(option, value) ?? this.skipToVal;
    this.invertVal = this.invertOption.extractValue(option, value) ?? this.invertVal;
    this.relatedVal = this.relatedOption.extractValue(option, value) ?? this.relatedVal;
    this.sortVal = this.sortOption.extractValue(option, value) ?? this.sortVal;
    this.uuidVal = this.uuidOption.extractValue(option, value) ?? this.uuidVal;

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

    if (DEBUG) {
      console.debug(policy);
      if (policy.from) console.debug(toUTCDatetimeString(policy.from));
      if (policy.to) console.debug(toUTCDatetimeString(policy.to));
      const debug: Partial<this> = {};
      for (const key in this) {
        if (typeof this[key] != 'object') debug[key] = this[key];
      }
      console.debug(debug);
    }

    const { journal } = context;

    const postings: [Posting, Amount][] = [];

    const executor = QueryEngine.create(policy).compile();

    const { acceptLedgObject } = executor.query;

    const valuate = this.getValuationFunction(context);

    executor.executeRelatedTransactions(
      journal,
      this.relatedVal ?
        txn => {
          const children = txn.postings;

          for (let i = 0;i < children.length;i++) {
            const posting = children[i];
            if (!acceptLedgObject(posting)) { // sibling = anything that doesn't match
              postings.push([posting, getDefault(valuate(txn, posting.amount), posting.amount)]);
            }
          }
        }:
        txn => {
          const children = txn.postings;

          for (let i = 0; i < children.length; i++) {
            const posting = children[i];
            if (acceptLedgObject(posting)) {
              postings.push([posting, getDefault(valuate(txn, posting.amount), posting.amount)]);
            }
          }
        }
    );

    const sortOpt = this.sortVal;

    // date|desc|asc

    const table = new Table({
      justify: ["left", "left", "left", "right", "right", "right"],
    });

    table.addRow(['TxnID', policy.useDate === "date" ? 'Date' : 'Aux. Date', 'Desc', 'Acc', 'Amnt', 'Tot']);

    let sum = Amount.ZERO;

    postings.sort(
      sortOpt == "date" ?
      ([a], [b]) => policy.useLedgObjDate(a) - policy.useLedgObjDate(b) : (
        sortOpt == "asc" ?
          ([, a], [, b]) => a.naiveCompareTo(b) :
          ([, a], [, b]) => b.naiveCompareTo(a)
      )
    ).forEach(([posting, amnt]) => {
      if (this.invertVal) {
        amnt = amnt.times(Rational.NEGATIVE_ONE);
      }

      sum = sum.plus(amnt);

      const date = policy.useLedgObjDate(posting);

      if (this.skipToVal && date < this.skipToVal) return;

      const dispPolicy = context.amountDisplayPolicy.naiveCopy();
      dispPolicy.showPlus = true;

      table.addRow([
        new Stylable(posting.transactionID).color('cyan'),
        new Stylable(context.dateFormat.formatDate(date) ).color('cyanBright'),
        new Stylable(posting.description).color('whiteBright'),


        posting.metadata.virt === true ?
          new Stylable(`[${posting.account.identifier}]`).italic(true) :
          new Stylable(posting.account.identifier),
        new AmountSpan(amnt, dispPolicy),
        new AmountSpan(sum, context.amountDisplayPolicy),
      ]);
    });

    if (!this.uuidVal) {
      table.drop([1]);
    }

    context.printlnRenderable(table);

    return Ok;
  }
}