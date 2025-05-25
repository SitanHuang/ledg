import { TransactionBuilder } from "../../accounting/transaction.ts";
import { InputStreamJournalReaderParseError, InputStreamSourceDescriptor } from "../../parsing/journal/inputStreamJournalReader.ts";
import { JournalReader } from "../../parsing/journal/journalReader.ts";
import { isOk, Maybe, Ok } from "../../types.ts";
import { PriceDirectiveProcessor } from "../priceDirectiveProcessor.ts";
import { TransactionProcessor } from "../transactionProcessor.ts";

export type JournalReaderAdapterErrorHandler = (e: Error) => void;
export type JournalReaderAdapterEndHandler = () => void;

export class JournalReaderAdapter {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onEnd: JournalReaderAdapterEndHandler = () => { };
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onError: JournalReaderAdapterErrorHandler = () => { };

  setOnError(handler: JournalReaderAdapterErrorHandler) {
    this.onError = handler;
    return this;
  }
  setOnEnd(handler: JournalReaderAdapterEndHandler) {
    this.onEnd = handler;
    return this;
  }

  constructor(
    private readonly reader: JournalReader,
    private readonly txnProcessor: TransactionProcessor,
    private readonly priceDirectiveProcessor: PriceDirectiveProcessor,
  ) { }

  begin(): void {
    // All pricing directives get processed first
    this.reader.setOnPricing(this.priceDirectiveProcessor.processPriceDirective.bind(this.priceDirectiveProcessor));

    const txnBuilders: TransactionBuilder[] = [];
    this.reader.setOnData((builder) => {
      txnBuilders.push(builder.withInsertionOrder(txnBuilders.length));
      return Ok;
    });

    this.reader
      .setOnError(err => this.onError(err))
      .setOnEnd(() => {
        // Chronological re-sort
        txnBuilders.sort((a, b) => a.date! - b.date! || a.insertionOrder - b.insertionOrder);

        const procFunc = this.txnProcessor.processTransaction.bind(this.txnProcessor);
        for (let i = 0;i < txnBuilders.length;i++) {
          const result = procFunc(txnBuilders[i]);
          if (!isOk(result)) {
            const source = txnBuilders[i].source;

            const error = new InputStreamJournalReaderParseError(
              source instanceof InputStreamSourceDescriptor ? source.filePath : '<unknown source>',
              source.sourceText ?? '<null>',
              source instanceof InputStreamSourceDescriptor ? source.lineStart : -1,
              "Error commiting TransactionBuilder.", result
            );

            this.onError(error);

            return;
          }
        }

        this.onEnd();
      });

    this.reader.begin();
  }

  public promisify(): Promise<Maybe> {
    return new Promise((resolve) => {
      this.onEnd = () => {
        resolve(Ok);
      };
      this.onError = (error) => {
        resolve(error);
      };
    });
  }
  public promisifyAndBegin(): Promise<Maybe> {
    const promise = this.promisify();
    this.begin();
    return promise;
  }
}
