import { createReadStream } from "node:fs";
import { AmountFormatOptions } from "../../core/accounting/amount.ts";
import { InputStreamJournalReader } from "../../core/parsing/journal/inputStreamJournalReader.ts";
import { isValidCurrencyCode, ValueExpressionParser } from "../../core/parsing/valueExpressionParser.ts";
import { JournalReaderAdapter } from "../../core/pipelines/adapters/journalReaderAdapter.ts";
import { DefaultTransactionPipeline } from "../../core/pipelines/transactionPipeline.ts";
import { isOk, Maybe, Ok, Result } from "../../core/types.ts";
import { ArgParseError, Positionals } from "../argparse/argparse.ts";
import { Command } from "../argparse/command.ts";
import { Option, OptionValue } from "../argparse/option.ts";
import { LedgCLIContext } from "../context.ts";

export abstract class LedgCommand extends Command {

  protected inputFile?: string;

  protected readonly fileOption = new Option({
    name: "file",
    alias: "F",
    type: "string",
    required: true,
    description: "Ledg book entry file, or '-' to read from STDIN."
  });

  protected readonly showDefaultCurrencyOption = new Option({
    name: "show-default-currency",
    type: "boolean",
    defaultValue: false,
    description: "Do not hide the default currency code."
  });

  protected readonly defaultCurrencyOption = new Option({
    name: "default-currency",
    type: "string",
    defaultValue: "$",
    description: "Sets the default currency code.",
    inputStringRegex: ValueExpressionParser.CURRENCY_REGEX_FULL,
  });

  protected readonly amountFormatOption = new Option({
    name: "amount-format",
    type: "spec",
    description: "Sets the formats using spec string. ",
    longDescription: [
      "Format spec syntax:",
      "  [[currencyCode:] mod=val [, mod=val];]+",
      "",
      "  Leaving currencyCode unspecified to change the default display options.",
      "",
      "Modifiers:",
      "- minFractionDigits: (integer) Minimum decimal places displayed.",
      "- groupInterval: (integer) Digit grouping size.",
      "- displayPrecision: (integer) Maximum decimal places for display.",
      "- currencyCodeLocation: ('left'|'right'|'none') Position of the currency code relative to amount.",
      "- groupSeparator: (string) Separator character between digit groups.",
      "- decimalSeparator: (string) Character used for decimal points.",
      "- nullPlaceholder: (string) Placeholder text for null/undefined amounts.",
      "",
      "Examples:",
      '  USD: minFractionDigits=2, groupSeparator=",", decimalSeparator="."; EUR: currencyCodeLocation="right";',
    ].join("\n"),
  });

  override build(): void {
    super.build();

    this.inputFile = undefined;

    this.setOption(this.fileOption);
    this.setOption(this.showDefaultCurrencyOption);
    this.setOption(this.defaultCurrencyOption);
    this.setOption(this.amountFormatOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    this.inputFile = this.fileOption.extractValue(option, value) ?? this.inputFile;

    this.showDefaultCurrencyOption.extractValue(option, value, (val) => {
      this._cliContext.amountDisplayPolicy.showDefaultCurrency = val;
    });
    this.defaultCurrencyOption.extractValue(option, value, (val) => {
      this._cliContext.journal.configuration.valuationConfig.defaultCurrencyCode = val;
    });

    let error: Error | undefined;
    this.amountFormatOption.extractValue(option, value, (specGroups) => {
      const { amountDisplayPolicy, journal } = this._cliContext;

      for (const group of specGroups) {
        let targetPolicy: AmountFormatOptions = amountDisplayPolicy;

        if (group.groupName !== undefined) {
          if (!isValidCurrencyCode(group.groupName)) {
            error = new ArgParseError(`Spec "--${option.name}" contains an invalid curreny code as group name.`);
            return;
          }
          const currency = journal.currencyProvider.getOrCreateCurrencyById(group.groupName);
          targetPolicy = amountDisplayPolicy.getPolicy(currency);
          amountDisplayPolicy.overrideCurrency(currency, targetPolicy);
        }

        for (const { mod, val } of group.modGroups) {
          switch(mod) {
            case 'minFractionDigits':
            case 'groupInterval':
            case 'displayPrecision':
              if (typeof val !== 'number' || !Number.isInteger(val)) {
                error = new ArgParseError(`Spec "--${option.name}" expects integer for modifier ${mod}, got ${val}.`);
                return;
              }
              targetPolicy.useGrouping = val;
              break;
            case 'currencyCodeLocation':
              if (val !== 'left' && val !== 'right' && val !== 'none') {
                error = new ArgParseError(`Spec "--${option.name}" expects "left" | "right" | "none" for modifier ${mod}, got ${val}.`);
                return;
              }
              targetPolicy[mod] = val;
              break;
            case 'groupSeparator':
            case 'decimalSeparator':
            case 'nullPlaceholder':
              if (typeof val !== 'string') {
                error = new ArgParseError(`Spec "--${option.name}" expects string for modifier ${mod}, got ${val}.`);
                return;
              }
              targetPolicy[mod] = val;
              break;
            default:
              error = new ArgParseError(`Spec "--${option.name}" expects string for modifiers "minFractionDigits" | "groupInterval" | "displayPrecision" | "currencyCodeLocation" | "groupSeparator" | "decimalSeparator" | "nullPlaceholder", got ${mod}.`);
              return;
          }
        }
      }
    });

    return error ?? Ok;
  }

  private readonly _cliContext: LedgCLIContext = new LedgCLIContext();
  private _journalLoaded = false;

  async getCLIContext(): Promise<Result<LedgCLIContext>> {
    if (this._journalLoaded) return this._cliContext;

    const journal = this._cliContext.journal;

    const fromStdin = !this.inputFile || this.inputFile === "-";

    const journalReader = new InputStreamJournalReader({
      filePath: fromStdin ? "<stdin>" : this.inputFile!,
      readStream: fromStdin ? process.stdin : createReadStream(this.inputFile!),
      sourceModifiable: !fromStdin,
    });
    const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);
    const journalReaderAdapter = new JournalReaderAdapter(journalReader, transactionPipeline, transactionPipeline);
    const result = await journalReaderAdapter.promisifyAndBegin();

    if (!isOk(result)) {
      return result;
    }

    this._journalLoaded = true;

    return this._cliContext;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    if (positionals.length) {
      return new ArgParseError(`Command "${this.name}" does not allow positional arguments.`);
    }

    return Ok;
  }
}