import { Account } from "../../accounting/account.ts";
import { BoundPosting, Posting } from "../../accounting/posting.ts";
import { LedgObject } from "../../data/ledgObject.ts";
import { timestamp } from "../../types.ts";
import { AccountGlob } from "./accountGlob.ts";
import { Query } from "./query.ts";
import { QueryEngineExecutor } from "./queryEngineExecutor.ts";

export type ModifierQuery = RegExp | false;

export class QueryEngine {
  protected constructor() { /* stub */ }

  protected from?: timestamp;
  protected to?: timestamp;
  protected useDate: 'date' | 'date2' = 'date';

  protected modifiers = new Map<string, ModifierQuery>();
  protected accountGlob?: AccountGlob;

  static create(): QueryEngine {
    return new QueryEngine();
  }

  /**
   * Inclusive, min date.
   */
  withFrom(from?: timestamp) : this{
    this.from = from;
    return this;
  }

  /**
   * Exclusive, max date.
   */
  withTo(to?: timestamp): this {
    this.to = to;
    return this;
  }

  /**
   * Whether to use `date` or `date2` for date range conditions.
   */
  withUseDate(useDate: 'date' | 'date2'): this {
    this.useDate = useDate;
    return this;
  }

  /**
   * Account glob pattern search.
   */
  withAccount(pattern: string): this {
    this.accountGlob = new AccountGlob(pattern);
    return this;
  }

  /**
   * Modifiers include LedgObject.{description, id}, and everything in
   * LedgObject.metadata. The value of `false` strictly requires that the
   * modifier is undefined for the LedgObject.
   *
   * The `id` refers to `transactionID` for Posting objects.
   * The `description` will be searched in an OR condition for both the
   * transaction and posting descriptions.
   *
   * If `modifierName` was previously set,
   * the new `query` overrides it.
   *
   */
  withModifier(modifierName: string, query: ModifierQuery): this {
    this.modifiers.set(modifierName, query);
    return this;
  }

  compile(): QueryEngineExecutor {

    // Array has faster iteration
    const modifierList: [string, ModifierQuery][] = Array.from(this.modifiers.entries());
    const { from, to, accountGlob: account, useDate } = this;

    const testModQuery = (modQuery: ModifierQuery, target: unknown): boolean =>
      modQuery === false
        ? target === undefined
        : modQuery.exec(target?.toString() ?? '') !== null; // `g` / `y` flags cause hysterisis of `test()`, must use `exec`

    const query: Query = {
      acceptLedgObject: (ledgObject: LedgObject): boolean => {
        const date = useDate == 'date' ? ledgObject.date : ledgObject.date2;

        if (
          (Number.isFinite(from) && date < from!) ||
          (Number.isFinite(to) && date >= to!)
        ) {
          return false;
        }

        if (ledgObject instanceof Posting && account?.execute(ledgObject.account) === false) {
          return false;
        }

        for (let i = 0; i < modifierList.length;i++) {
          const modId = modifierList[i][0];
          const modQuery = modifierList[i][1];

          let target: unknown;

          if (modId == 'description') {
            // if it's a posting, we also need to check using OR condition on
            // the transaction's description
            if (ledgObject instanceof BoundPosting) {
              if (testModQuery(modQuery, ledgObject.transaction.description)) {
                continue;
              }
            }
            target = ledgObject.description;
          } else if (modId == 'id') {
            target = ledgObject instanceof Posting ? ledgObject.transactionID : ledgObject.id;
          } else {
            target = ledgObject.metadata[modId];
          }

          if (!testModQuery(modQuery, target)) {
            return false;
          }
        }

        return true;
      },
      acceptAccount: (account: Account): boolean => {
        return this.accountGlob ? this.accountGlob.execute(account) : true;
      }
    };
    return new QueryEngineExecutor(query);
  }
}