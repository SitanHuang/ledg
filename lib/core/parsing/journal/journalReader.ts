import { TransactionBuilder } from "../../accounting/transaction.ts";
import { Rational } from "../../math/rational.ts";
import { Maybe, Ok, timestamp } from "../../types.ts";

export type JournalReadStreamErrorHandler = (error: Error) => void;
export type JournalReadStreamEndHandler = () => void;
export type JournalReadStreamDataHandler = (data: TransactionBuilder) => Maybe;
export type JournalReadStreamPricingHandler = (cur1: string, cur2: string, date: timestamp, rate: Rational) => Maybe;

export abstract class JournalReader {
  public onEnd: JournalReadStreamEndHandler = () => undefined;
  public onError: JournalReadStreamErrorHandler = () => undefined;
  public onData: JournalReadStreamDataHandler = () => Ok;
  public onPricing: JournalReadStreamPricingHandler = () => Ok;

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
  setOnPricing(handler: JournalReadStreamPricingHandler) {
    this.onPricing = handler;
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