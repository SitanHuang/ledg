import { Maybe, timestamp } from "../types.ts";

export interface PriceDirectiveProcessor {
  /** fully validates and persists one pricing directive */
  processPriceDirective(date: timestamp, cur1: string, rateExpr: string): Maybe;
}