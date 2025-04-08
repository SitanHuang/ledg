import { ValuationConfiguration } from "../config/valuationConfigs.ts";
import { Amount, CurrencyConversionService, isNone, None, NoneType, Option, PostingBuilder, Rational, Result } from "../namespace.ts";
import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { ValuationPolicy } from "../valuation/policy.ts";

export class TransactionAutoBalanceError extends Error {}

export class TransactionAutoBalancer {
  constructor(
    public currencyConversionService: CurrencyConversionService,
    public currencyProvider: CurrencyProvider,
    public valuationConfig: ValuationConfiguration
  ) {}

  /**
   * Automatically balances transaction postings by calculating the inferred amount
   * for the posting without a specified amount.
   *
   * At most one posting can have an inferred (undefined) amount. If exactly one
   * inferred posting is found, its amount is automatically assigned by
   * balancing against the sum of other postings.
   *
   * @param postingBuilders list of postingBuilders to auto balance
   * @returns None if no posting has inferred amounts, PostingBuilder for the
   * posting with inferred amount, or TransactionAutoBalanceError
   */
  autoBalanceTransaction(postingBuilders: readonly PostingBuilder[]): Result<Option<PostingBuilder>, TransactionAutoBalanceError> {
    let inferredPosting: PostingBuilder | NoneType = None;

    for (let i = 0;i < postingBuilders.length;i++) {
      const posting = postingBuilders[i];
      if (posting.getAmount() === undefined) {
        if (!isNone(inferredPosting)) {
          return new TransactionAutoBalanceError("Only one posting with inferred amount can exist in a transaction.");
        }

        inferredPosting = posting;
      }
    }

    // Most of the time, there is no inferred posting, so we won't waste time adding the Amounts
    if (isNone(inferredPosting)) {
      return inferredPosting;
    }

    const inferredPostingBuilder: PostingBuilder = inferredPosting;

    // Slow path: inferred posting exists
    const balance = this.sumPostingAmounts(postingBuilders).times(Rational.NEGATIVE_ONE);

    if (this.valuationConfig.autoBalanceTargetCurrency === false) {
      // No conversion
      return inferredPostingBuilder.withAmount(balance).setModified("Posting amount is automatically inferred.");
    }

    const currency = this.currencyProvider.getOrCreateCurrencyById(this.valuationConfig.autoBalanceTargetCurrency);
    const valuationDate = inferredPostingBuilder.getDate();

    if (valuationDate == null) {
      return new TransactionAutoBalanceError("Attempting to auto balance a posting without date attribute.");
    }

    const result = balance.convertTo(currency, this.currencyConversionService, new ValuationPolicy(valuationDate));
    if (isNone(result)) {
      return new TransactionAutoBalanceError(`Unable to convert inferred amount to the request currency "${currency.id}".`);
    }

    return inferredPostingBuilder.withAmount(balance).setModified(`Posting amount is automatically inferred and converted to "${currency.id}".`);
  }

  private sumPostingAmounts(postingBuilders: readonly PostingBuilder[]): Amount {
    let sum = Amount.ZERO;

    for (let i = 0; i < postingBuilders.length; i++) {
      const amount = postingBuilders[i].getAmount();
      if (amount !== undefined) {
        sum = sum.plus(amount);
      }
    }

    return sum;
  }
}