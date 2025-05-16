import { createReadStream } from "node:fs";
import { Journal } from "../../core/data/journal.ts";
import { InputStreamJournalReader } from "../../core/parsing/journal/inputStreamJournalReader.ts";
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

  override build(): void {
    super.build();

    this.inputFile = undefined;

    this.setOption(this.fileOption);
  }

  protected override consumeOption(option: Option, value: OptionValue): Maybe<ArgParseError> {
    this.inputFile = this.fileOption.extractValue(option, value) ?? this.inputFile;

    // TODO: stdin+

    return Ok;
  }

  private _cliContext?: LedgCLIContext;

  async getCLIContext(): Promise<Result<LedgCLIContext>> {
    if (this._cliContext) {
      return this._cliContext;
    }

    const journal = Journal.create();

    // TODO: load in configuration

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

    const context = new LedgCLIContext(journal);

    return this._cliContext = context;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    if (positionals.length) {
      return new ArgParseError(`Command "${this.name}" does not allow positional arguments.`);
    }

    return Ok;
  }
}