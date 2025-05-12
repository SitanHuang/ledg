import { timestamp } from "../types.ts";

export class ValuationPolicy {

  constructor(
    public valuationDate: timestamp
  ) {}

  withValuationDate(valuationDate: timestamp): this {
    this.valuationDate = valuationDate;
    return this;
  }
}
