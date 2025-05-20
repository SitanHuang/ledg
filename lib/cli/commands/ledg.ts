import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { AmountFormatOptions } from "../../core/accounting/amount.ts";
import { InputStreamJournalReader } from "../../core/parsing/journal/inputStreamJournalReader.ts";
import { isValidCurrencyCode, ValueExpressionParser } from "../../core/parsing/valueExpressionParser.ts";
import { JournalReaderAdapter } from "../../core/pipelines/adapters/journalReaderAdapter.ts";
import { DefaultTransactionPipeline } from "../../core/pipelines/transactionPipeline.ts";
import { hasResult, isOk, Maybe, Ok, Result } from "../../core/types.ts";
import { ArgParseError, Positionals } from "../argparse/argparse.ts";
import { Option, OptionValue } from "../argparse/option.ts";
import { LedgCLIContext } from "../context.ts";
import { DEBUG } from "../entry.ts";
import { ConfigurableCommand } from "./config.ts";

export abstract class LedgCommand extends ConfigurableCommand {

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

  protected readonly pipeConsoleLongOption = new Option({
    name: "pipe-console-long",
    type: "string",
    description: "Redirect process.stdout to the piped command if the buffered output is longer than terminal height.",
    longDescription: [
      "An useful example is to put the following into your ~/.ledg2rc:",
      "  ```.ledg2rc",
      "  pipe-console-long = \"less -X -r -S +G -~ -F -\"",
      "  ```",
    ].join("\n")
  });
  protected readonly pipeConsoleShortOption = new Option({
    name: "pipe-console-short",
    type: "string",
    description: "Redirect process.stdout to the piped command if the buffered output is shorter than terminal height.",
    longDescription: [
      "An useful example is to put the following into your ~/.ledg2rc:",
      "  ```.ledg2rc",
      "  pipe-console-short = \"less -X -r -S -F -\"",
      "  ```",
    ].join("\n")
  });

  protected _pipeConsoleLongOptionVal?: string;
  get pipeConsoleLongOptionVal(): string | undefined {
    return this._pipeConsoleLongOptionVal;
  }
  set pipeConsoleLongOptionVal(val: string | undefined) {
    this._pipeConsoleLongOptionVal = val;
  }
  protected pipeConsoleShortOptionVal?: string;

  protected readonly lightThemeOption = new Option({
    name: "light-theme",
    alias: 'lt',
    type: "boolean",
    description: "Put this in your .ledg2rc if your terminal has light background.",
  });
  protected readonly formatOption = new Option({
    name: "format",
    type: "string",
    description: `Output reports in "ascii" | "csv" | "html" format.`,
    defaultValueDisplay: `"ascii"`,
    inputStringRegex: /^ascii|csv|html$/
  });

  protected readonly dpOption = new Option({
    name: "display-precision",
    alias: "dp",
    type: "string",
    description: `Alias for "--amount-format=displayPrecision=<val>". "inf" for exact fractions.`,
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
      "- displayPrecision: (integer) Maximum decimal places for display. \"inf\" for exact fractions.",
      "- currencyCodeLocation: ('left'|'right'|'none') Position of the currency code relative to amount.",
      "- groupSeparator: (string) Separator character between digit groups.",
      "- decimalSeparator: (string) Character used for decimal points.",
      "- nullPlaceholder: (string) Placeholder text for null/undefined amounts.",
      "",
      "Examples:",
      '  USD: minFractionDigits=2, groupSeparator=",", decimalSeparator="."; EUR: currencyCodeLocation="right";',
    ].join("\n"),
  });

  protected readonly dateFormatOption = new Option({
    name: "date-format",
    type: "string",
    description: "Sets the formats for dates (midnight timestamps).",
    longDescription: [
      "See --datetime-format for options. Using non-date format strings forces times to be displayed even for midnight timestamps.",
    ].join("\n"),
  });
  protected readonly datetimeFormatOption = new Option({
    name: "datetime-format",
    type: "string",
    description: "Sets the formats for datetimes (timestamps that are not midnight).",
    longDescription: [
      "Format datetime using tokens:",
      "YY   Two-digit year (25)",
      "YYYY Four-digit year (2025)",
      "M    Month 1-12",
      "MM   01-12",
      "MMM  Jan-Dec",
      "MMMM Full month",
      "D    Day 1-31",
      "DD   01-31",
      "d    Weekday 0-6 (Sun=0)",
      "dd   Su-Sa",
      "ddd  Short name",
      "dddd Full name",
      "H    Hour 0-23",
      "HH   00-23",
      "h   1-12",
      "hh   01-12",
      "m    Minute 0-59",
      "mm   00-59",
      "s   Second 0-59",
      "ss   00-59",
      "SSS  Milliseconds",
      "A/a  AM/PM (uppercase/lowercase)",
      "Example: 'MMM YY HH' -> '1月 25年 00時' (ja-JP)",
      "Note: --locale affects month/day names and formatting conventions"
    ].join("\n"),
  });
  protected readonly localeOption = new Option({
    name: "locale",
    type: "string",
    description: "A IETF language tag for displaying datetimes.",
    defaultValueDisplay: "System Locale"
  });

  override build(): void {
    super.build();

    this.fileOption.required = true;

    this.setOption(this.showDefaultCurrencyOption);
    this.setOption(this.defaultCurrencyOption);
    this.setOption(this.amountFormatOption);
    this.setOption(this.dateFormatOption);
    this.setOption(this.datetimeFormatOption);
    this.setOption(this.localeOption);
    this.setOption(this.lightThemeOption);
    this.setOption(this.dpOption);
    this.setOption(this.formatOption);
    this.setOption(this.pipeConsoleLongOption);
    this.setOption(this.pipeConsoleShortOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    const result = super.consumeOption(option, value);

    if (!isOk(result)) {
      return result;
    }

    this.pipeConsoleLongOptionVal = this.pipeConsoleLongOption.extractValue(option, value) ?? this.pipeConsoleLongOptionVal;
    this.pipeConsoleShortOptionVal = this.pipeConsoleShortOption.extractValue(option, value) ?? this.pipeConsoleShortOptionVal;

    this.showDefaultCurrencyOption.extractValue(option, value, (val) => {
      this._cliContext.amountDisplayPolicy.showDefaultCurrency = val;
    });
    this.defaultCurrencyOption.extractValue(option, value, (val) => {
      this._cliContext.journal.configuration.valuationConfig.defaultCurrencyCode = val;
    });
    this.lightThemeOption.extractValue(option, value, (val) => {
      if (this._cliContext.renderFormat.target === "ascii") {
        this._cliContext.renderFormat.lightTerminal = val;
      }
    });
    let error: Error | undefined;

    this.formatOption.extractValue(option, value, (val) => {
      if (val === "ascii" || val === "csv" || val === "html") {
        this._cliContext.renderFormat.target = val;
      } else {
        error = new ArgParseError(`Option --${option.name} requires "ascii" | "csv" | "html|, but got ${val}.`);
      }
    });

    this.dpOption.extractValue(option, value, (dp) => {
      const val = dp.toLowerCase() === 'inf' ? Infinity : Number(dp);

      if (val !== Infinity && !Number.isInteger(val)) {
        error = new ArgParseError(`Spec "--${option.name}" expects integer or "inf", got ${val}.`);
        return;
      }

      this._cliContext.amountDisplayPolicy.displayPrecision = val;
    });

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
                if (mod === 'displayPrecision' && val.toString().toLowerCase() === 'inf') {
                  targetPolicy.displayPrecision = Infinity;
                  break;
                }
                error = new ArgParseError(`Spec "--${option.name}" expects integer for modifier ${mod}, got ${val}.`);
                return;
              }
              targetPolicy[mod == 'groupInterval' ? 'useGrouping' : mod] = val;
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

    this.localeOption.extractValue(option, value, (locale) => {
      try {
        this._cliContext.dateFormat.locale = new Intl.Locale(locale);
      } catch (e) {
        error = new ArgParseError(`Spec "--${option.name}" expects a valid IETF tag.`);
        error.cause = e;
      }
    });
    this.dateFormatOption.extractValue(option, value, (fmt) => {
      this._cliContext.dateFormat.dateFormat = fmt;
    });
    this.datetimeFormatOption.extractValue(option, value, (fmt) => {
      this._cliContext.dateFormat.datetimeFormat = fmt;
    });

    return error ?? Ok;
  }

  override exec(argv: readonly string[]): Result<Positionals, ArgParseError> {
    const result = super.exec(argv);

    this._cliContext.pipeConsoleBuffer(this.pipeConsoleLongOptionVal, this.pipeConsoleShortOptionVal);

    if (!hasResult(result)) {
      return result;
    }

    return result;
  }

  private readonly _cliContext: LedgCLIContext = LedgCLIContext.getCurrentContext();
  private _journalLoaded = false;

  getBookCwd(): string {
    return this.isFromStdin || !this.inputFile ? this.cwd : resolve(dirname(this.inputFile));
  }

  get isFromStdin() {
    return this.inputFile === "-";
  }

  async getCLIContext(): Promise<Result<LedgCLIContext>> {
    if (this._journalLoaded) return this._cliContext;

    const begin = performance.now();

    const journal = this._cliContext.journal;

    const fromStdin = this.isFromStdin;

    const journalReader = new InputStreamJournalReader({
      filePath: !this.inputFile || fromStdin ? "<stdin>" : this.inputFile,
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

    if (DEBUG) {
      const dur = performance.now() - begin;
      console.debug(`Journal loaded in ${dur} ms (${(journal.transactionStore.size() / (dur / 1000)).toFixed(1)} txn/sec).`);
    }

    return this._cliContext;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    if (positionals.length) {
      return new ArgParseError(`Command "${this.name}" does not allow positional arguments.`);
    }

    return Ok;
  }
}