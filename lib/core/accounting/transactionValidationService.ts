import { ValuationConfiguration } from "../config/valuationConfigs.ts";
import { Maybe, Ok } from "../types.ts";
import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { Amount } from "./amount.ts";
import { PostingBuilder } from "./posting.ts";
import { TransactionBuilder } from "./transaction.ts";

export class TransactionValidationError extends Error {
  protected readonly __transactionValidationErrorBrand = undefined;
}

export class TransactionValidationService {

  constructor(
    public readonly currencyConversionService: CurrencyConversionService,
    public readonly valuationConfig: ValuationConfiguration,
    public readonly valuationPolicy?: ValuationPolicy,
  ) {}

  private readonly _valuationPolicy = new ValuationPolicy(0);

  /**
   * Validates a transactionBuilder for final formulation into a Transaction object:
   *   1. Transaction postings must contain **defined** amounts. (At this point,
   *      the autobalancing has already been done.)
   *   2. Transaction must balance to zero, within the balance tolerance set by
   *      `valuationConfig`, by converting currencies at the **primary date** of
   *      the **transaction**.
   */
  validate(transactionBuilder: TransactionBuilder): Maybe<TransactionValidationError> {
    const postingBuilders: PostingBuilder[] = transactionBuilder.getPostingBuilders();

    let sum = Amount.ZERO;

    for (let i = 0; i < postingBuilders.length; i++) {
      const posting = postingBuilders[i];
      const amount = posting.getAmount();
      if (amount === undefined) {
        return new TransactionValidationError("Transaction contains postings with undefined amounts.");
      }

      sum = amount.plus(sum);
    }

    const tolerance = this.valuationConfig.transactionBalanceTolerance;

    if (!Number.isFinite(transactionBuilder.date) || !Number.isFinite(transactionBuilder.date2)) {
      return new TransactionValidationError(`TransactionBuilder requires date and date2.`);
    }

    const valuationPolicy = this.valuationPolicy ?? this._valuationPolicy.withValuationDate(transactionBuilder.date!);

    const result = sum.isZeroDescriptive(this.currencyConversionService, valuationPolicy, tolerance);

    if (result !== true) {
      const error = new TransactionValidationError(`The transaction balance of [${sum.toString()}] is not zero (tolerance=${tolerance.toFractionString()}), evaluated at transaction primary date.`);

      error.cause = result;

      if (result instanceof Amount) {
        error.cause = new Error(`Unresolved balance of: ${result.toString()} = ${result.toFractionString()}`);
      }
      return error;
    }

    return Ok;
  }
}