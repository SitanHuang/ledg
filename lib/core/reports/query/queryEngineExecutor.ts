import { Account } from "../../accounting/account.ts";
import { BoundPosting } from "../../accounting/posting.ts";
import { Transaction } from "../../accounting/transaction.ts";
import { Journal } from "../../data/journal.ts";
import { IteratorCallback } from "../../data/transactionStore.ts";
import { Query } from "./query.ts";

export type PostingAcceptor = IteratorCallback<BoundPosting, void>;
export type TransactionAcceptor = IteratorCallback<Transaction, void>;
export type AccountAcceptor = IteratorCallback<Account, void>;

export class QueryEngineExecutor {
  constructor(
    protected readonly query: Query
  ) {}

  executeTransactions(journal: Journal, transactionAcceptor: TransactionAcceptor): void {
    const { acceptLedgObject } = this.query;

    journal.transactionStore.iterateAll(transaction => {
      if (!acceptLedgObject(transaction)) {
        return;
      }

      return transactionAcceptor(transaction);
    });
  }

  executePostings(journal: Journal, postingAcceptor: PostingAcceptor): void {
    const { query } = this;
    const { acceptAccount, acceptLedgObject } = query;
    const { accountManager, transactionStore } = journal;
    const accounts = accountManager.getAccountsList();

    for (let i = 0;i < accounts.length;i++) {
      if (!acceptAccount(accounts[i])) {
        continue;
      }

      transactionStore.iteratePostingsByAccount(accounts[i], (posting: BoundPosting) => {
        if (!acceptLedgObject(posting)) {
          return;
        }

        const result = postingAcceptor(posting);

        if (result === "stop") {
          i = Infinity;
          return result;
        }
      });
    }
  }

  queryAccounts(journal: Journal): Account[] {
    const acceptAccount = this.query.acceptAccount;

    return journal.accountManager.getAccountsList().filter(account => {
      return acceptAccount(account);
    });
  }
}