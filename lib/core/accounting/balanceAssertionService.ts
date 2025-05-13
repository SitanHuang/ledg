import { TransactionStore } from "../data/transactionStore.ts";
import { timestamp } from "../types.ts";
import { Account } from "./account.ts";
import { Amount } from "./amount.ts";

export type AccountStrictlyZeroEvaluationMethod = "primary-date-only" | "auxiliary-date-only";

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
  ): true | [AccountStrictlyZeroEvaluationMethod, Amount][] {
    let balance1 = Amount.ZERO;
    let balance2 = Amount.ZERO;

    this.transactionStore.iteratePostingsByAccount(account, (posting) => {
      const d = posting.date;
      const d2 = posting.date2;

      if (d <= assertionDate) {
        balance1 = balance1.plus(posting.amount);
      }
      if (d2 <= assertionDate) {
        balance2 = balance2.plus(posting.amount);
      }
    });

    if (balance1.isStrictlyZero() && balance2.isStrictlyZero()) {
      return true;
    }

    return [["primary-date-only", balance1], ["auxiliary-date-only", balance2]];
  }
}