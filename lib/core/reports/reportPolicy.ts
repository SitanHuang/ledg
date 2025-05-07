import { timestamp } from "../types.ts";
import { Currency } from "../valuation/currency.ts";
import { QueryPolicy } from "./query/queryPolicy.ts";

/**
 * Valuation strategy that amount conversions should occur.
 *   - eop - at End of Reporting Period
 *   - txnDate - at the primary date of the transaction (since
 *     TransactionValidationService mandates that the transaction must balance
 *     at transaction primary date)
 *   - `timestamp` - any custom valuation date
 */
export type ValuationStrategy = "eop" | "txnDate" | timestamp;

export class ReportPolicy extends QueryPolicy {
  /**
   * The period interval within the `from` -> `to` window.
   */
  reportPeriodInterval?: ReportPeriodInterval;

  /**
   * The currency that all amounts should be convert to in a report. Undefined
   * value leaves amounts unconverted.
   */
  valuationCurrency?: Currency;

  valuationStrategy: ValuationStrategy = "txnDate";

  withValutionCurrency(currency: Currency): this {
    this.valuationCurrency = currency;
    return this;
  }

  withValutionStrategy(strategy: ValuationStrategy): this {
    this.valuationStrategy = strategy;
    return this;
  }
}

export class ReportPeriodInterval {
  dayInterval = 0;
  monthInterval = 0;
  yearInterval = 0;
}