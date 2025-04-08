import { SourceDescriptor } from "../data/sourceDescriptor.ts";
import { Account, AccountIdentifier } from "./account.ts";
import { Amount } from "./amount.ts";
import { TransactionID } from "./types.ts";
import { LedgObject, LedgObjectBuilder, Metadata, UUID } from "../data/ledgObject.ts";
import { isOk, Maybe, Ok, Result, timestamp } from "../types.ts";
import { AccountAssignmentError, AccountManager } from "./accountManager.ts";

export class Posting implements LedgObject {
  constructor(
    public readonly id: UUID,
    public readonly date: timestamp,
    public readonly date2: timestamp,
    public readonly transactionID: TransactionID,
    public readonly account: Account,
    public readonly amount: Amount | null, // null if empty
    public readonly source: SourceDescriptor,
    public readonly metadata: Metadata = {},
  ) {}
}

export class PostingBuilder extends LedgObjectBuilder<Posting> {
  protected transactionID?: TransactionID;
  protected account?: Account;
  protected amount?: Amount;

  constructor(
    public accountManager: AccountManager
  ) { super(); }

  public getTransactionID() {
    return this.transactionID;
  }
  public getAccount() {
    return this.account;
  }
  public getAmount() {
    return this.amount;
  }
  public getDate() {
    return this.date;
  }

  withTransactionID(transactionID: TransactionID): this {
    this.transactionID = transactionID;
    return this;
  }

  withAccount(account: Account): this {
    this.account = account;
    return this;
  }

  /**
   * Requests and assigns an account using the account manager.
   *
   * @param identifier - Identifier used for account assignment.
   * @returns Ok if assignment is successful; otherwise, an AccountAssignmentError.
   */
  assignAccount(identifier: AccountIdentifier): Maybe<AccountAssignmentError> {
    const result = this.accountManager.requestAccountAssignment(identifier, this);
    if (result instanceof AccountAssignmentError)
      return result;

    return Ok;
  }

  withAmount(amount: Amount): this {
    this.amount = amount;
    return this;
  }

  override isBuildable(): Maybe<Error> {
    const parentBuildable = super.isBuildable();
    if (!isOk(parentBuildable)) {
      return parentBuildable;
    }

    if (this.transactionID == null) {
      return new Error("Attemping to build a Posting with empty transactionId.");
    }
    if (this.account == null) {
      return new Error("Attemping to build a Posting with empty Account.");
    }
    if (this.amount == null) {
      return new Error("Attemping to build a Posting with empty Amount");
    }

    return Ok;
  }

  override build(): Result<Posting, Error> {
    const buildable = this.isBuildable();

    if (!isOk(buildable))
      return buildable;

    return this.result = new Posting(
      this.id!,
      this.date!,
      this.date2!,
      this.transactionID!,
      this.account!,
      this.amount!,
      this.source,
      this.metadata,
    );
  }
}