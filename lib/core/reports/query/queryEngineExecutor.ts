import { Account } from "../../accounting/account.ts";
import { Posting } from "../../accounting/posting.ts";
import { Journal } from "../../data/journal.ts";
import { IteratorCallback } from "../../data/transactionStore.ts";
import { Query } from "./query.ts";

export type PostingAcceptor = IteratorCallback<Posting, void>;
export type AccountAcceptor = IteratorCallback<Account, void>;

export class QueryEngineExecutor {
  constructor(
    protected readonly query: Query
  ) {}

  executePostings(journal: Journal, postingAcceptor: PostingAcceptor): void {
    const { query } = this;
    const { acceptAccount, acceptLedgObject } = query;
    const { accountManager, transactionStore } = journal;
    const accounts = accountManager.getAccountsList();

    for (let i = 0;i < accounts.length;i++) {
      if (!acceptAccount(accounts[i])) {
        continue;
      }

      transactionStore.iteratePostingsByAccount(accounts[i], (posting: Posting) => {
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