import { SourceDescriptor } from "../data/sourceDescriptor.ts";
import { Account, AccountIdentifier } from "./account.ts";
import { Amount } from "./amount.ts";
import { TransactionID } from "./types.ts";
import { LedgObject, LedgObjectBuilder, Metadata, UUID } from "../data/ledgObject.ts";
import { isOk, Maybe, Ok, Result, timestamp } from "../types.ts";
import { AccountAssignmentError, AccountManager } from "./accountManager.ts";
import { TransactionBuilder } from "./transaction.ts";

export class Posting implements LedgObject {
  constructor(
    public readonly id: UUID,
    public readonly date: timestamp,
    public readonly date2: timestamp,
    public readonly description: string,
    public readonly transactionID: TransactionID,
    public readonly account: Account,
    public readonly amount: Amount,
    public readonly source: SourceDescriptor,
    public readonly metadata: Metadata = {},
  ) {}
}

export class PostingBuilder extends LedgObjectBuilder<Posting> {
  protected transactionID?: TransactionID;
  protected accountIdentifier?: AccountIdentifier;
  protected amount?: Amount;
  protected amountString?: string;
  public accountManager?: AccountManager

  constructor(
    accountManager?: AccountManager
  ) {
    super();

    this.accountManager = accountManager;
  }

  attachAccountManager(accountManager: AccountManager): this {
    this.accountManager = accountManager;
    return this;
  }

  public getTransactionID() {
    return this.transactionID;
  }
  public getAccountIdentifier() {
    return this.accountIdentifier;
  }
  public getAmount() {
    return this.amount;
  }
  public getAmountString() {
    return this.amountString;
  }
  /**
   * Inherits date, date2, desc, and metadata (shallow copy) from a TransactionBuilder.
   */
  fromTransaction(transaction: TransactionBuilder): this {
    this.date = transaction.date;
    this.date2 = transaction.date2;
    this.description = transaction.description;
    this.metadata = { ...transaction.metadata };
    return this;
  }

  withTransactionID(transactionID: TransactionID): this {
    this.transactionID = transactionID;
    return this;
  }

  withAccountIdentifier(account: AccountIdentifier): this {
    this.accountIdentifier = account;
    return this;
  }

  withAmountString(amountString: string): this {
    this.amountString = amountString;
    return this;
  }

  withAmount(amount: Amount): this {
    this.amount = amount;
    return this;
  }

  private assignedAccount?: Account;

  override isBuildable(): Maybe<Error> {
    const parentBuildable = super.isBuildable();
    if (!isOk(parentBuildable)) {
      return parentBuildable;
    }

    if (!this.accountManager)
      return new Error("AccountManager is null.");

    if (this.transactionID == null) {
      return new Error("Attemping to build a Posting with empty transactionId.");
    }
    if (this.accountIdentifier == null) {
      return new Error("Attemping to build a Posting with empty account identifier.");
    }
    if (this.amount == null) {
      return new Error("Attemping to build a Posting with empty Amount");
    }

    const result = this.accountManager.requestAccountAssignment(this.accountIdentifier, this);
    if (result instanceof AccountAssignmentError)
      return result;

    this.assignedAccount = result;

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
      this.description,
      this.transactionID!,
      this.assignedAccount!,
      this.amount!,
      this.source,
      this.metadata,
    );
  }
}