import { createReadStream } from "node:fs";
import { InputStreamJournalReader } from "../../core/parsing/journal/inputStreamJournalReader.ts";
import { ValueExpressionParser } from "../../core/parsing/valueExpressionParser.ts";
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

  override build(): void {
    super.build();

    this.inputFile = undefined;

    this.setOption(this.fileOption);
    this.setOption(this.showDefaultCurrencyOption);
    this.setOption(this.defaultCurrencyOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    this.inputFile = this.fileOption.extractValue(option, value) ?? this.inputFile;

    this.showDefaultCurrencyOption.extractValue(option, value, (val) => {
      this._cliContext.amountDisplayPolicy.showDefaultCurrency = val;
    });
    this.defaultCurrencyOption.extractValue(option, value, (val) => {
      this._cliContext.journal.configuration.valuationConfig.defaultCurrencyCode = val;
    });

    return Ok;
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