import { SourceDescriptor } from "../data/sourceDescriptor.ts";
import { BoundPosting, Posting, PostingBuilder } from "./posting.ts";
import { TransactionID } from "./types.ts";
import { LedgObject, LedgObjectBuilder, Metadata } from "../data/ledgObject.ts";
import { isOk, Maybe, Ok, Result, timestamp } from "../types.ts";
import { TransactionAutoBalanceError, TransactionAutoBalancer } from "./transactionAutoBalancer.ts";
import { TransactionValidationService } from "./transactionValidationService.ts";
import { AccountIdentifier } from "./account.ts";

export class Transaction implements LedgObject {
  constructor(
    public readonly id: TransactionID,
    public readonly date: timestamp,
    public readonly date2: timestamp,
    public readonly description: string,
    public readonly postings: BoundPosting[] = [],
    public readonly source: SourceDescriptor,
    public readonly metadata: Metadata = {},
    // Below is only for "open xxxx" directives
    public readonly accountOpened: AccountIdentifier | undefined = undefined,
    // Below is only for "close xxxx" directives
    public readonly accountClosed: AccountIdentifier | undefined = undefined,
  ) {}
};

export class TransactionBuilder extends LedgObjectBuilder<Transaction> {
  protected postingBuilders: PostingBuilder[] = [];
  public accountOpened: AccountIdentifier | undefined = undefined;
  public accountClosed: AccountIdentifier | undefined = undefined;
  public transactionValidationService?: TransactionValidationService;

  constructor(
    transactionValidationService?: TransactionValidationService
  ) {
    super();
    this.transactionValidationService = transactionValidationService;
  }

  withAccountOpened(accountOpened: AccountIdentifier): this {
    this.accountOpened = accountOpened;
    return this;
  }
  withAccountClosed(accountClosed: AccountIdentifier): this {
    this.accountClosed = accountClosed;
    return this;
  }

  /**
   * Auto-generates transaction ID, if not given, and set modified status with
   * a message on auto generation.
   * @returns
   */
  override genId(): this {
    if (this.id) return this;

    super.genId();

    this.setModified("Auto generated transaction ID.");

    return this;
  }

  getPostingBuilders() {
    return this.postingBuilders;
  }

  attachTransactionValidationService(transactionValidationService: TransactionValidationService) {
    this.transactionValidationService = transactionValidationService;
  }

  /**
   * Appends a PostingBuilder to the transaction.
   *
   * Automatically assigns the current transaction ID to the posting builder.
   *
   * @param postingBuilder - The PostingBuilder instance to append.
   * @returns The builder instance.
   */
  appendPostingBuilder(postingBuilder: PostingBuilder): this {
    this.postingBuilders.push(postingBuilder.withTransactionID(this.id!));
    return this;
  }

  /**
   * Checks if the Transaction is buildable and each aggregated PostingBuilder
   * are buildable.
   *
   * @returns Ok if buildable, otherwise an Error explaining the failure.
   */
  override isBuildable(): Maybe<Error> {
    const parentBuildable = super.isBuildable();
    if (!isOk(parentBuildable)) {
      return parentBuildable;
    }

    if (this.accountOpened?.length === 0)
      return new Error("Account name to be opened cannot be empty.");
    if (this.accountClosed?.length === 0)
      return new Error("Account name to be closed cannot be empty.");
    if (this.accountClosed && this.accountOpened)
      return new Error("Transaction cannot open and close accounts at the same time.");

    if ((this.accountClosed || this.accountOpened) && this.date !== this.date2)
      return new Error("Account open/close directives cannot have an auxiliary date.");

    if (!this.transactionValidationService)
      return new Error("TransactionValidationService is null.");

    const validation = this.transactionValidationService.validate(this);
    if (!isOk(validation))
      return validation;

    for (let i = 0;i < this.postingBuilders.length;i++) {
      const postingBuilder = this.postingBuilders[i];
      const buildResult = postingBuilder.isBuildable();
      if (!isOk(buildResult) || postingBuilder.getTransactionID() !== this.id) {
        const error = new Error("Transaction contains a Posting that is not buildable.");
        error.cause = buildResult;
        return error;
      }
    }
    return Ok;
  }

  autoBalance(transactionAutoBalancer: TransactionAutoBalancer): Maybe<TransactionAutoBalanceError> {
    const result = transactionAutoBalancer.autoBalanceTransaction(this.postingBuilders);

    if (result instanceof TransactionAutoBalanceError) {
      return result;
    }

    return Ok;
  }

  /**
   * Builds the Transaction object using the aggregated PostingBuilders.
   *
   * @returns The built Transaction instance wrapped in a Result, or an Error.
   */
  override build(): Result<Transaction, Error> {
    const buildable = this.isBuildable();

    if (!isOk(buildable))
      return buildable;

    const postings: Posting[] = new Array(this.postingBuilders.length);
    for (let i = 0;i < this.postingBuilders.length;i++) {

      // At this point, each PostingBuilder is buildable with transaction ID assigned
      postings[i] = this.postingBuilders[i].build() as Posting;
    }

    this.result = new Transaction(
      this.id!,
      this.date!,
      this.date2!,
      this.description,
      (postings as BoundPosting[]), // force it but we make sure it's right type later
      this.source,
      this.metadata,
      this.accountOpened,
      this.accountClosed,
    );

    for (let i = 0; i < postings.length; i++) {
      postings[i] = new BoundPosting(postings[i], this.result);
    }

    return this.result;
  }
}