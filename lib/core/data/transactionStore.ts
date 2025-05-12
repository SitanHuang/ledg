import { Account, AccountIdentifier } from "../accounting/account.ts";
import { BoundPosting } from "../accounting/posting.ts";
import { Transaction } from "../accounting/transaction.ts";
import { TransactionID } from "../accounting/types.ts";
import { Maybe, Ok } from "../types.ts";

export class TransactionStoreError extends Error {};
export class DuplicateUUIDError extends TransactionStoreError {};

export type IteratorFlowControl = "stop" | "continue" | undefined; // undefined is same as stop
export const IteratorStop: IteratorFlowControl = "stop";
export const IteratorContinue: IteratorFlowControl = "continue";

export type IteratorReturnValue<T> = IteratorFlowControl | T;
export type IteratorCallback<O extends object, T> = (obj: O) => IteratorReturnValue<T>;

/**
 * The transaction store implements insertion, deletion, update, and iteration
 * mechanisms throughout a journal, synchronously.
 *
 * The class enforces UUID uniqueness of each transation on modification.
 */
export abstract class TransactionStore {

  abstract insertTransaction(transaction: Transaction): Maybe<TransactionStoreError>;

  abstract iterateAll(callback: IteratorCallback<Transaction, void>): void;

  abstract size(): number;

  abstract iteratePostingsByAccount(account: Account, callback: IteratorCallback<BoundPosting, void>): void;

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

  getTransactionByPosting(posting: BoundPosting): Transaction {
    return this.getTransactionById(posting.transactionID)!;
  }
}

export class DefaultTransactionStore extends TransactionStore {
  // using for i loop is the fastest V8 iteration method
  private readonly transactions: Transaction[] = [];
  private readonly transactionIdMap = new Map<TransactionID, Transaction>();
  private readonly transactionAccountIdMap = new Map<AccountIdentifier, BoundPosting[]>();

  override insertTransaction(transaction: Transaction): Maybe<TransactionStoreError> {
    if (this.getTransactionById(transaction.id))
      return new DuplicateUUIDError(`Cannot insert transaction with duplicate UUID: ${transaction.id}`);

    this.transactions.push(transaction);

    // cache transactonId to Transaction
    this.transactionIdMap.set(transaction.id, transaction);

    // cache accountId to BoundPosting[]
    const postings = transaction.postings;
    for (let i = 0;i < postings.length;i++) {
      const posting = postings[i];
      const account = posting.account;

      const postingsArray = this.transactionAccountIdMap.get(account.identifier);
      if (!postingsArray) {
        this.transactionAccountIdMap.set(account.identifier, [posting]);
      } else {
        postingsArray.push(posting);
      }

    }

    return Ok;
  }

  override iterateAll(callback: IteratorCallback<Transaction, void>) {
    const txns = this.transactions;
    for (let i = 0;i < txns.length;i++) {
      if (callback(txns[i]) == IteratorStop) {
        return;
      }
    }
  }

  override iteratePostingsByAccount(account: Account, callback: IteratorCallback<BoundPosting, void>): void {
    const postings = this.transactionAccountIdMap.get(account.identifier);

    if (!postings) return;

    for (let i = 0; i < postings.length; i++) {
      if (callback(postings[i]) == IteratorStop) {
        return;
      }
    }
  }


  override getTransactionById(id: TransactionID): Transaction | undefined {
    return this.transactionIdMap.get(id);
  }

  override getTransactionByPosting(posting: BoundPosting): Transaction {
    return this.getTransactionById(posting.transactionID)!;
  }

  override size() {
    return this.transactions.length;
  }
}