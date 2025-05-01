import { Maybe } from "../types.ts";
import { TransactionBuilder } from "../accounting/transaction.ts";

export interface TransactionProcessor {
  /** fully validates and persists one TransactionBuilder */
  processTransaction(builder: TransactionBuilder): Maybe;
}