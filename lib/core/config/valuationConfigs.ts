import { timestamp } from "../types.ts";

export class ValuationConfiguration {
  /**
   * When a transaction has exactly one posting, specifies currency code should
   * the inferred balance be converted to. When set to false, the inferred
   * balance is simply the negative of the sum of other postings without
   * conversion.
   *
   * Regardless of the global valuationMethod, inferred amounts are strictly
   * valuated at a posting's date.
   */
  public autoBalanceTargetCurrency: false | string = false;

  /**
   * date      - valuate based on a posting's date
   * eop       - in multiperiod reports, use end of period date as valuation date
   * timestamp - a specified date to use for currency valuation
   */
  public valuationMethod: "date" | "eop" | timestamp = "eop";
}