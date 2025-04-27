import { Maybe } from "../types.ts";
import { TransactionBuilder } from "../accounting/transaction.ts";

export abstract class TransactionProcessor {
  /** fully validates and persists one TransactionBuilder */
  abstract process(builder: TransactionBuilder): Maybe;
}