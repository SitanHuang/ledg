import { timestamp } from "../types.ts";

export class ValuationPolicy {

  constructor(
    public readonly valuationDate: timestamp
  ) {}
}
