import { Transaction } from "../../../core/accounting/transaction.ts";
import { QueryEngine } from "../../../core/reports/query/queryEngine.ts";
import { SerializationOptions, serializeTransaction, serializeTransactionDate } from "../../../core/serialize/transaction.ts";
import { hasResult, isOk, Maybe, Ok } from "../../../core/types.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { DEBUG } from "../../entry.ts";
import { QueryCommand } from "../query.ts";

export class PrintCommand extends QueryCommand {
  protected readonly sortOption = new Option({
    name: "sort",
    type: "string",
    defaultValue: "insertion-order",
    description: `Sorts transactions. If using "desc" | "asc", dates to be sorted will follow the --date / --date2 options.`,
    inputStringRegex: /^insertion-order|desc|asc$/,
  });

  protected readonly ledgerOption = new Option({
    name: "ledger",
    type: "boolean",
    description: `Output ledger-compatible format. Sets --resolve-amounts = true.`,
    defaultValueDisplay: "false",
  });
  protected readonly resolveOption = new Option({
    name: "resolve-amounts",
    type: "boolean",
    description: `Instead of outputting the user's amount source text, resolve the numerical amount put to 10 decimal places.` +
                 ` When set to false, --ledger is forced to be false.`,
    defaultValueDisplay: "false",
  });
  protected readonly pricesOption = new Option({
    name: "prices",
    type: "boolean",
    description: `Prepend all pricing directives.`,
    defaultValueDisplay: "false",
  });

  protected readonly pricesOnlyOption = new Option({
    name: "prices-only",
    type: "boolean",
    description: `Print all pricing directives only.`,
    defaultValueDisplay: "false",
  });

  protected printPricing = false;
  protected printPricingOnly = false;
  protected sortOptionValue = "insertion-order";
  protected serializationOptions: Partial<SerializationOptions> = {
    useSourceText: true,
    ledgerCompatible: false,
  }

  constructor() {
    super("print", "Print transactions.");
  }

  override build(): void {
    super.build();

    this.fromOption.required = false;
    this.fromOption.defaultValueDisplay = "-inf";
    this.fromOption.defaultValue = undefined;
    this.toOption.required = false;
    this.toOption.defaultValue = undefined;
    this.toOption.defaultValueDisplay = "inf";

    this.accountOption.description += " For the print command, transactions are matched as long as one of the posting accounts match.";

    this.setOption(this.sortOption);
    this.setOption(this.resolveOption);
    this.setOption(this.ledgerOption);
    this.setOption(this.pricesOption);
    this.setOption(this.pricesOnlyOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const parent = super.consumeOption(option, value);
    if (!isOk(parent)) return parent;

    this.sortOptionValue = this.sortOption.extractValue(option, value) ?? this.sortOptionValue;

    this.resolveOption.extractValue(option, value, val => {
      if (val === false) { // resolve = false
        this.serializationOptions = { useSourceText: true, ledgerCompatible: false };
      } else { // resolve = true
        this.serializationOptions.useSourceText = false;
      }
    });

    this.ledgerOption.extractValue(option, value, val => {
      this.serializationOptions.ledgerCompatible = val;
      if (val) {
        this.serializationOptions.useSourceText = false;
      }
    });

    this.printPricing = this.pricesOption.extractValue(option, value) ?? this.printPricing;
    this.printPricingOnly = this.pricesOnlyOption.extractValue(option, value) ?? this.printPricingOnly;

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const result = await super.run(positionals);
    if (!isOk(result)) {
      return result;
    }

    const policy = this.getQueryPolicy();

    if (DEBUG) {
      console.debug(policy);
    }

    const context = await this.getCLIContext();
    if (!hasResult(context)) {
      return context;
    }

    const { journal } = context;

    const transactions: Transaction[] = [];

    QueryEngine.create(policy).compile().executeTransactions(journal, txn => {
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

    if (this.printPricing || this.printPricingOnly) {
      const records = journal.currencyConversionService.registrationRecords;

      for (let i = 0; i < records.length; i++) {
        const record = records[i];

        console.log(`P ${serializeTransactionDate(record.timestamp)} ${record.from.id} ${record.rate.toString({
          minFractionDigits: 2,
          useGrouping: 0,
          groupSeparator: '',
          decimalSeparator: '.',
          displayPrecision: 10,
          showPlus: false,
        }).padStart(20, ' ')} ${record.to.id}`)
      }
    }

    if (!this.printPricingOnly) {
      const opts: SerializationOptions = Object.assign({ lineDelimiter: context.lineDelimiter }, this.serializationOptions);

      for (let i = 0;i < transactions.length;i++) {
        console.log(serializeTransaction(transactions[i], opts));
      }
    }


    return Ok;
  }
}