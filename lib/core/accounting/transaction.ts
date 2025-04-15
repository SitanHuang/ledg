import { SourceDescriptor } from "../data/sourceDescriptor.ts";
import { Posting, PostingBuilder } from "./posting.ts";
import { TransactionID } from "./types.ts";
import { LedgObject, LedgObjectBuilder, Metadata } from "../data/ledgObject.ts";
import { isOk, Maybe, Ok, Result, timestamp } from "../types.ts";
import { TransactionAutoBalanceError, TransactionAutoBalancer } from "./transactionAutoBalancer.ts";
import { TransactionValidationService } from "./transactionValidationService.ts";

export class Transaction implements LedgObject {
  constructor(
    public readonly id: TransactionID,
    public readonly date: timestamp,
    public readonly date2: timestamp,
    public readonly postings: Posting[] = [],
    public readonly source: SourceDescriptor,
    public readonly metadata: Metadata = {},
  ) {}
};

export class TransactionBuilder extends LedgObjectBuilder<Transaction> {
  protected postingBuilders: PostingBuilder[] = [];

  constructor(
    public transactionValidationService: TransactionValidationService // stub for transaction-specific validation logic
  ) { super(); }

  getPostingBuilders() {
    return this.postingBuilders;
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
  isBuildable(): Maybe<Error> {
    const parentBuildable = super.isBuildable();
    if (!isOk(parentBuildable)) {
      return parentBuildable;
    }

    const validation = this.transactionValidationService.validate(this);
    if (!isOk(validation))
      return validation;

    for (let i = 0;i < this.postingBuilders.length;i++) {
      const postingBuilder = this.postingBuilders[i];
      if (!postingBuilder.isBuildable() || postingBuilder.getTransactionID() !== this.id) {
        return new Error("Transaction contains a Posting that is not buildable.");
      }
    }
    return Ok;
  }

  autoBalance(transactionAutoBalancer: TransactionAutoBalancer): Maybe<TransactionAutoBalanceError> {
    const result = transactionAutoBalancer.autoBalanceTransaction(this.postingBuilders);

    if (result instanceof TransactionAutoBalanceError) {
      return TransactionAutoBalanceError;
    }

    return Ok;
  }

  /**
   * Builds the Transaction object using the aggregated PostingBuilders.
   *
   * @returns The built Transaction instance wrapped in a Result, or an Error.
   */
  build(): Result<Transaction, Error> {
    const buildable = this.isBuildable();

    if (!isOk(buildable))
      return buildable;

    const postings: Posting[] = new Array(this.postingBuilders.length);
    for (let i = 0;i < this.postingBuilders.length;i++) {

      // At this point, each PostingBuilder is buildable with transaction ID assigned
      postings[i] = this.postingBuilders[i].build() as Posting;
    }

    return this.result = new Transaction(
      this.id!,
      this.date!,
      this.date2!,
      postings,
      this.source,
      this.metadata,
    );
  }
}