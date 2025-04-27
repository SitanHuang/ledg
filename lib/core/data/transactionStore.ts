import { Maybe, Ok } from "../types.ts";
import { Transaction } from "../accounting/transaction.ts";
import { TransactionID } from "../accounting/types.ts";

export class TransactionStoreError extends Error {};
export class DuplicateUUIDError extends TransactionStoreError {};

export type IteratorFlowControl = "stop" | "continue";
export const IteratorStop: IteratorFlowControl = "stop";
export const IteratorContinue: IteratorFlowControl = "continue";

export type IteratorReturnValue<T> = IteratorFlowControl | T;
export type IteratorCallback<T> = (transaction: Transaction) => IteratorReturnValue<T>;

/**
 * The transaction store implements insertion, deletion, update, and iteration
 * mechanisms throughout a journal, synchronously.
 *
 * The class enforces UUID uniqueness of each transation on modification.
 */
export abstract class TransactionStore {

  abstract insertTransaction(transaction: Transaction): Maybe<TransactionStoreError>;

  abstract iterateAll(callback: IteratorCallback<void>): void;

  getTransactionById(id: TransactionID): Transaction | undefined {
    let transaction: Transaction | undefined;
    this.iterateAll((x) => {
      if (x.id == id) {
        transaction = x;
        return IteratorStop;
      }
    });
    return transaction;
  }
}

export class DefaultTransactionStore extends TransactionStore {

  // using for i loop is the fastest V8 iteration method
  private readonly transactions: Transaction[] = [];
  private readonly transactionMap = new Map<TransactionID, Transaction>();

  insertTransaction(transaction: Transaction): Maybe<TransactionStoreError> {
    if (this.getTransactionById(transaction.id))
      return new DuplicateUUIDError(`Cannot insert transaction with duplicate UUID: ${transaction.id}`);

    this.transactions.push(transaction);
    this.transactionMap.set(transaction.id, transaction);

    return Ok;
  }

  iterateAll(callback: IteratorCallback<void>) {
    for (let i = 0;i < this.transactions.length;i++) {
      if (callback(this.transactions[i]) == IteratorStop) {
        return;
      }
    }
  }

  getTransactionById(id: TransactionID): Transaction | undefined {
    return this.transactionMap.get(id);
  }
}