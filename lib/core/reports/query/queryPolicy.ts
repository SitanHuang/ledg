import { LedgObject } from "../../data/ledgObject.ts";
import { timestamp } from "../../types.ts";
import { AccountGlob } from "./accountGlob.ts";

export type ModifierQuery = RegExp | false;

export class QueryPolicy {
  /**
   * Inclusive, min date. Can be plus/minus infinity.
   */
  from?: timestamp;
  /**
   * Exclusive, max date. Can be plus/minus infinity.
   */
  to?: timestamp;
  /**
   * Whether to use `date` or `date2` for date range conditions.
   */
  useDate: 'date' | 'date2' = 'date';

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
  modifiers = new Map<string, ModifierQuery>();

  /**
   * Exclusively select virtual/non-virtual postings
   */
  realOnly = false;

  /**
   * Account glob pattern search.
   */
  accountGlob?: AccountGlob;

  withFrom(from?: timestamp): this {
    this.from = from;
    return this;
  }

  withTo(to?: timestamp): this {
    this.to = to;
    return this;
  }

  withRealOnly(realOnly: boolean): this {
    this.realOnly = realOnly;
    return this; // TODO: test cases
  }

  withUseDate(useDate: 'date' | 'date2'): this {
    this.useDate = useDate;
    return this;
  }

  withAccount(pattern: string): this {
    this.accountGlob = new AccountGlob(pattern);
    return this;
  }

  withModifier(modifierName: string, query: ModifierQuery): this {
    this.modifiers.set(modifierName, query);
    return this;
  }

  // TODO: tags

  useLedgObjDate(obj: LedgObject): timestamp {
    return this.useDate == 'date' ? obj.date : obj.date2;
  }

  clone(): QueryPolicy {
    const copy = new QueryPolicy();
    copy.from = this.from;
    copy.to = this.to;
    copy.useDate = this.useDate;
    copy.realOnly = this.realOnly;
    copy.modifiers = new Map(this.modifiers);
    if (this.accountGlob) {
      copy.accountGlob = new AccountGlob(this.accountGlob.pattern);
    }
    return copy;
  }
}