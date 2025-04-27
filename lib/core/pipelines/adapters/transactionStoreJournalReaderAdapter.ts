import { Maybe, Ok } from "../../types.ts";
import { JournalReader } from "../../parsing/journal/journalReader.ts";
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
    private readonly processor: TransactionProcessor,
  ) { }

  begin(): void {
    this.reader
      .setOnData(b => this.processor.process(b))
      .setOnError(err => this.onError(err))
      .setOnEnd(() => this.onEnd());

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
