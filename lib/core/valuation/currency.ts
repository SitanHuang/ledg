import { Rational } from "../math/rational.ts";
import { None, Option, timestamp } from "../types.ts";

export class Currency {
  constructor(
    public readonly id: string,
    public displayFormat?: string) {
  }
}