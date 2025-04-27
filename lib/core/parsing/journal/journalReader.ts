import { TransactionBuilder } from "../../accounting/transaction.ts";
import { Maybe, Ok } from "../../types.ts";

export type JournalReadStreamErrorHandler = (error: Error) => void;
export type JournalReadStreamEndHandler = () => void;
export type JournalReadStreamDataHandler = (data: TransactionBuilder) => Maybe;

export abstract class JournalReader {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onEnd: JournalReadStreamEndHandler = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onError: JournalReadStreamErrorHandler = () => {};
  public onData: JournalReadStreamDataHandler = () => Ok;

  setOnError(handler: JournalReadStreamErrorHandler) {
    this.onError = handler;
    return this;
  }
  setOnEnd(handler: JournalReadStreamEndHandler) {
    this.onEnd = handler;
    return this;
  }
  setOnData(handler: JournalReadStreamDataHandler) {
    this.onData = handler;
    return this;
  }

  forkFrom(parentReader: Readonly<JournalReader>) {
    this.onError = parentReader.onError;
    this.onEnd = parentReader.onEnd;
    this.onData = parentReader.onData;
    return this;
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

  abstract begin(): void;

}