import { timestamp } from "../types.ts";
import { TransactionStore } from "../data/transactionStore.ts";
import { Account } from "./account.ts";
import { Amount } from "./amount.ts";

export class BalanceAssertionService {
  constructor(
    public readonly transactionStore: TransactionStore
  ) {}

  /**
   * Asserts whether an account at the time of `assertionDate` is
   * **strictly zero** (i.e., zero on all currencies without conversions),
   * regardless of whether using date/date2 and whether accounting virtual or
   * real transactions.
   */
  assertAccountStrictlyZero(
    account: Account,
    assertionDate: timestamp,
  ): true | Amount {
    let balance = Amount.ZERO;

    this.transactionStore.iteratePostingsByAccount(account, (posting) => {
      const d = posting.date;
      const d2 = posting.date2;

      if (d <= assertionDate || d2 <= assertionDate) {
        balance = balance.plus(posting.amount);
      }
    });

    if (balance.isStrictlyZero()) {
      return true;
    }

    return balance;
  }
}