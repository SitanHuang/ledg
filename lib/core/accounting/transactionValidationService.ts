import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";
import { Maybe, Ok } from "../types.ts";
import { Amount } from "./amount.ts";
import { PostingBuilder } from "./posting.ts";
import { TransactionBuilder } from "./transaction.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { ValuationConfiguration } from "../config/valuationConfigs.ts";

export class TransactionValidationError extends Error {}

export class TransactionValidationService {

  constructor(
    public readonly currencyConversionService: CurrencyConversionService,
    public readonly valuationConfig: ValuationConfiguration,
    public readonly valuationPolicy?: ValuationPolicy,
  ) {}

  /**
   * Validates a transactionBuilder for final formulation into a Transaction object.
   *
   * At this point, the autobalancing has already been done.
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
      return new TransactionValidationError(`The transaction balance of [${sum.toString()}] is not zero (tolerance=${tolerance.toFractionString()}), evaluated at transaction primary date.`);
    }

    const valuationPolicy = this.valuationPolicy ?? new ValuationPolicy(transactionBuilder.date!);

    if (!sum.isZero(this.currencyConversionService, valuationPolicy, tolerance)) {
      return new TransactionValidationError(`The transaction balance of [${sum.toString()}] is not zero (tolerance=${tolerance.toFractionString()}), evaluated at transaction primary date.`);
    }

    return Ok;
  }
}