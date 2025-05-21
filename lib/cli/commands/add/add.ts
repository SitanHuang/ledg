import { dirname, resolve } from "path";
import { ACCOUNT_OPEN } from "../../../core/accounting/accountManager.ts";
import { PostingBuilder } from "../../../core/accounting/posting.ts";
import { TransactionBuilder } from "../../../core/accounting/transaction.ts";
import { validateMetadataKeyValPair } from "../../../core/data/ledgObject.ts";
import { NullSourceDescriptor } from "../../../core/data/sourceDescriptor.ts";
import { sniffLineEnding } from "../../../core/parsing/journal/inputStreamJournalReader.ts";
import { DefaultTransactionPipeline } from "../../../core/pipelines/transactionPipeline.ts";
import { QueryEngine } from "../../../core/reports/query/queryEngine.ts";
import { QueryPolicy } from "../../../core/reports/query/queryPolicy.ts";
import { serializeTransaction, serializeTransactionDate } from "../../../core/serialize/transaction.ts";
import { hasResult, isOk, Maybe, Ok, timestamp } from "../../../core/types.ts";
import { getUTCTodayMidnight } from "../../../core/utils/dateUtils.ts";
import { renderable } from "../../../render/embeddable.ts";
import { Span } from "../../../render/span.ts";
import { Stylable } from "../../../render/stylable.ts";
import { ArgParseError, Positionals } from "../../argparse/argparse.ts";
import { Option, OptionValue } from "../../argparse/option.ts";
import { ExitCode } from "../../context.ts";
import { LedgCommand } from "../ledg.ts";
import { appendFileSync, statSync } from "fs";

export class AddCommand extends LedgCommand {

  readonly txnBuilder = new TransactionBuilder()
    .withSource(new NullSourceDescriptor())
    .genId();

  protected readonly appendToOption = new Option({
    name: "append-to",
    alias: 'dist',
    type: "string",
    description: "File for which the transaction is to be appended to. Relative path is resolved with respect to the input file.",
    defaultValueDisplay: "<input file>",
  });

  protected readonly dateOption = new Option({
    name: "date",
    type: "datetime",
    description: "Transaction primary date.",
    defaultValueDisplay: "today",
  });
  protected readonly date2Option = new Option({
    name: "date2",
    type: "datetime",
    description: "Transaction auxiliary date.",
  });

  protected readonly resolveOption = new Option({
    name: "resolve",
    type: "boolean",
    description: "Instead of outputting the user's amount source text, resolve the numerical amount put to 10 decimal places.",
  });

  protected readonly modifierOption = new Option({
    name: "modifier",
    alias: "m",
    type: "string",
    description: `Specify a modifier of the transaction using "modifierName:JSON Value" format.`,
  });

  protected readonly pendingOption = new Option({
    name: "pending",
    alias: "!",
    type: "boolean",
    description: `Set pending.`,
  });
  protected readonly clearedOption = new Option({
    name: "cleared",
    alias: "*",
    type: "boolean",
    description: `Set pending = false.`,
  });
  protected readonly virtualOption = new Option({
    name: "virtual",
    alias: "virt",
    type: "boolean",
    description: `Set virtual.`,
  });

  private appendToVal?: string;
  private dateVal: timestamp = getUTCTodayMidnight();
  private date2Val?: timestamp;
  private resolveVal = false;
  private pendingVal = false;
  private virtualVal = false;

  constructor() {
    super(
      "add",
      "Append a transaction to file. Wrap account glob in brackets (\"[...]\") for virtual postings.",
      "<txn desc> [ [<account glob> [desc:<posting desc>] <amount expr>] ... ] [<account glob> [desc:<posting desc>] [amount expr]]]"
    );
  }

  override build(): void {
    super.build();

    const keep = [
      this.helpOption,
      this.fileOption,
      this.noConfigOption,
      this.debugOption,
    ];

    for (const key in this) {
      const val = this[key];

      if (val instanceof Option && !keep.includes(val)) {
        this.removeOption(val);
      }
    }

    this.setOption(this.appendToOption);
    this.setOption(this.dateOption);
    this.setOption(this.date2Option);
    this.setOption(this.resolveOption);
    this.setOption(this.pendingOption);
    this.setOption(this.clearedOption);
    this.setOption(this.virtualOption);
    this.setOption(this.modifierOption);

    this.unknownOptsAsPositional = true;
  }

  protected override consumeOption(opt: Option, val: OptionValue): Maybe<ArgParseError> {
    const result = super.consumeOption(opt, val);
    if (!isOk(result)) return result;

    this.appendToVal = this.appendToOption.extractValue(opt, val) ?? this.appendToVal;
    this.dateVal = this.dateOption.extractValue(opt, val) ?? this.dateVal;
    this.date2Val = this.date2Option.extractValue(opt, val) ?? this.date2Val;
    this.resolveVal = this.resolveOption.extractValue(opt, val) ?? this.resolveVal;
    this.pendingVal = this.pendingOption.extractValue(opt, val) ?? this.pendingVal;
    this.virtualVal = this.virtualOption.extractValue(opt, val) ?? this.virtualVal;

    this.clearedOption.extractValue(opt, val, opt => {
      if (opt) {
        this.pendingVal = false;
      }
    });

    const modSpec = this.modifierOption.extractValue(opt, val);

    if (modSpec) {
      const colonIdx = modSpec.indexOf(':');
      const modError = new ArgParseError(`Option "--${this.modifierOption.name}" requires "modifierName:JSON" syntax.`);

      if (colonIdx < 1) {
        return modError;
      }

      const name = modSpec.substring(0, colonIdx);
      let value: string | number | object;

      try {
        value = JSON.parse(modSpec.substring(colonIdx + 1));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch {
        // force cast into string
        value = modSpec.substring(colonIdx + 1);
      }

      const error = validateMetadataKeyValPair(name, value);

      if (error != null) {
        modError.cause = error;
        return modError;
      }

      if (typeof value == 'string' && name === 'tags') {
        value = value.toLocaleUpperCase();
      }

      this.txnBuilder.metadata[name] = value;
    }

    return Ok;
  }

  override async run(positionals: Positionals): Promise<Maybe> {
    const context = await this.getCLIContext();
    if (!hasResult(context)) return context;

    context.releaseConsoleBuffer(true);

    const { journal } = context;
    const { accountManager } = journal;

    const printlnRenderable = context.printlnRenderable.bind(context);

    const invalidSyntaxError = new ArgParseError("Invalid syntax. Synopsis: " + this.synopsis);

    if (positionals.length < 1) {
      return invalidSyntaxError;
    }

    if (this.isFromStdin && !this.appendToVal) {
      return new ArgParseError("--append-to cannot be neglected when --file is STDIN.");
    } else if (!this.isFromStdin && this.appendToVal) {
      this.appendToVal = resolve(dirname(this.inputFile ?? ''), this.appendToVal);
    } else if (!this.inputFile && !this.appendToVal) {
      return new ArgParseError("--append-to must be specified.");
    }

    const distFile = resolve(this.appendToVal ?? this.inputFile!);

    if (!statSync(distFile, { throwIfNoEntry: false })?.isFile()) {
      const answer = await context.promptLine(`"${distFile}" is not a file. Continue? `);
      if (!['y', 'yes'].includes(answer.toLowerCase().trim())) {
        console.error("Abort.");
        return new ExitCode(1);
      }
    }

    if (this.pendingVal) {
      this.txnBuilder.metadata.pending = true;
    }
    if (this.virtualVal) {
      this.txnBuilder.metadata.virt = true;
    }

    this.date2Val = this.date2Val ?? this.dateVal;

    const date = this.dateVal;
    const date2 = this.date2Val;

    const txnBuilder = this.txnBuilder
      .withDate(date)
      .withDate2(date2)
      .withDescription(positionals[0].raw);

    for (let i = 1; i < positionals.length; i++) {

      const posting = new PostingBuilder()
        .fromTransaction(txnBuilder); // copy over all metadata, including description

      // Match Account

      let acc = positionals[i].raw;

      if (acc.startsWith('[') && acc.endsWith(']')) {
        acc = acc.slice(1, -1);
        posting.metadata.virt = true;
      }

      const accStylable = new Stylable(new Span(acc)).bold(true);

      const accounts = QueryEngine.create(
        new QueryPolicy().withAccount(acc)
      ).compile().queryAccounts(journal).filter(x =>
        accountManager.getAccountStatusByContext(x.identifier, txnBuilder) === ACCOUNT_OPEN
      ).sort((a, b) => a.identifier.localeCompare(b.identifier));

      if (accounts.length === 0) {
        const dateStr = serializeTransactionDate(date) + (date2 !== date ? '=' + serializeTransactionDate(date2) : '');
        printlnRenderable(renderable`Error: "${accStylable}" did not match any accounts currently open at ${dateStr}.`);
        return new ExitCode(1);
      }

      let matchedAcc: string;

      if (accounts.length > 1) {
        printlnRenderable(renderable`Multiple accounts matched for: "${accStylable}"\n`);

        const padLen = Number(accounts.length).toString().length;

        accounts.forEach((acc, idx) => {
          const bulletPt = new Span((idx + 1).toString().padStart(padLen, ' '));
          printlnRenderable(renderable`  ${new Stylable(bulletPt).color('cyan')}. ${acc.identifier}`);
        });

        printlnRenderable(renderable``);

        matchedAcc = accounts[Number(await context.promptLine("Choose one: ", {
          validator: (ans: string) => !!(ans && accounts[Number(ans) - 1]),
          outputReplacer: (ans: string) => new Stylable(new Span(accounts[Number(ans) - 1].identifier)).color('greenBright'),
        })) - 1].identifier;

        printlnRenderable(renderable``);
      } else {
        matchedAcc = accounts[0].identifier;
      }

      posting.withAccountIdentifier(matchedAcc);

      // Description lookahead

      let lookahead: string | undefined = positionals[++i]?.raw; // consume

      if (lookahead?.startsWith("desc:")) {
        posting.withDescription(lookahead.slice(5));
        lookahead = positionals[++i]?.raw; // consume another
      }

      // Per spec, when user leaves empty, it is "".
      const amntStr = lookahead ?? "";
      posting.withAmountString(amntStr);

      txnBuilder.appendPostingBuilder(posting);
    }

    const transactionPipeline = DefaultTransactionPipeline.fromJournal(journal);

    const result = transactionPipeline.processTransaction(txnBuilder);

    if (!isOk(result)) {
      return result;
    }

    const txn = journal.transactionStore.getTransactionById(txnBuilder.id!);

    if (!txn) {
      return new Error("FATAL: New transaction is not found in memory!");
    }

    const serialized = serializeTransaction(txn, {
      lineDelimiter: await sniffLineEnding(distFile) ?? context.lineDelimiter,
      ledgerCompatible: false,
      useSourceText: !this.resolveVal,
      newLineAtStart: true,
      newLineAtEnd: false,
    });

    printlnRenderable(renderable`Append to ${new Stylable(distFile).bold(true)}:`);

    serialized.split(/\r\n|\n|\r/).forEach(line => {
      printlnRenderable(new Stylable('+ ' + line).color('green'));
    });

    const answer = await context.promptLine(`Proceed? `);
    if (!['y', 'yes'].includes(answer.toLowerCase().trim())) {
      console.error("Abort.");
      return new ExitCode(1);
    }

    try {
      appendFileSync(distFile, serialized);

      printlnRenderable(renderable`${new Stylable('Entry added.').color('greenBright').bold(true)}`);
    } catch (err) {
      return err as Error;
    }

    return Ok;
  }
}