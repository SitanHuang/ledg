import { Currency } from "../valuation/currency.ts";
import { Rational } from "../math/rational.ts";
import { Option, None, isNone } from "../types.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";

/**
 * Represents a multi-currency monetary amount. Internally, amounts are stored
 * as a map keyed by currency id.
 */
export class Amount {
  public readonly sourceString?: string;

  private constructor(
    private readonly amounts: ReadonlyMap<string, { currency: Currency; value: Rational }>,
    sourceString?: string
  ) {
    this.sourceString = sourceString;
  }

  public static ZERO: Amount = new Amount(new Map());

  /**
   * Helper to create an Amount instance. It takes an optional array of entries
   * (currency/value pairs) and filters out zero-valued entries.
   */
  public static create(entries: readonly { currency: Currency; value: Rational }[]=[], sourceString?: string): Amount {
    const map = new Map<string, { currency: Currency; value: Rational }>();
    if (entries) {
      for (const { currency, value } of entries) {
        if (!value.isZero()) {
          if (map.has(currency.id)) {
            const existing = map.get(currency.id)!;
            const sum = existing.value.plus(value);
            if (sum.isZero()) {
              map.delete(currency.id);
            } else {
              map.set(currency.id, { currency: currency, value: sum });
            }
          } else {
            if (!value.isZero()) {
              map.set(currency.id, { currency: currency, value: value });
            }
          }
        }
      }
    }
    return new Amount(map, sourceString);
  }

  private static fromMap(map: ReadonlyMap<string, { currency: Currency; value: Rational }>, sourceString?: string): Amount {
    return new Amount(map, sourceString);
  }
  public static fromAmount(amount: Amount, sourceString?: string): Amount {
    return new Amount(amount.amounts, sourceString);
  }

  /**
   * Adds another Amount to this Amount. Returns a new Amount.
   */
  public plus(other: Amount): Amount {
    const result = new Map(this.amounts);
    for (const [curId, { currency, value }] of other.amounts) {
      if (result.has(curId)) {
        const existing = result.get(curId)!;
        const sum = existing.value.plus(value);
        if (sum.isZero()) {
          result.delete(curId);
        } else {
          result.set(curId, { currency: currency, value: sum });
        }
      } else {
        if (!value.isZero()) {
          result.set(curId, { currency: currency, value: value });
        }
      }
    }
    return Amount.fromMap(result);
  }

  /**
   * Subtracts another Amount from this Amount. Returns a new Amount.
   */
  public minus(other: Amount): Amount {
    const result = new Map(this.amounts);
    for (const [curId, { currency, value }] of other.amounts) {
      if (result.has(curId)) {
        const existing = result.get(curId)!;
        const sum = existing.value.minus(value);
        if (sum.isZero()) {
          result.delete(curId);
        } else {
          result.set(curId, { currency: currency, value: sum });
        }
      } else {
        if (!value.isZero()) {
          result.set(curId, { currency: currency, value: Rational.ZERO.minus(value) });
        }
      }
    }
    return Amount.fromMap(result);
  }

  /**
   * Multiplies this Amount by a scalar factor. Returns a new Amount.
   */
  public times(factor: Rational): Amount {
    const result = new Map<string, { currency: Currency; value: Rational }>();
    for (const [curId, { currency, value }] of this.amounts) {
      const product = value.times(factor);
      if (!product.isZero()) {
        result.set(curId, { currency, value: product });
      }
    }
    return Amount.fromMap(result);
  }

  /**
   * Divides this Amount by a scalar divisor. Returns a new Amount.
   */
  public div(divisor: Rational): Amount {
    const result = new Map<string, { currency: Currency; value: Rational }>();
    for (const [curId, { currency, value }] of this.amounts) {
      const quotient = value.div(divisor);
      if (!quotient.isZero()) {
        result.set(curId, { currency, value: quotient });
      }
    }
    return Amount.fromMap(result);
  }

  /**
   * Converts this Amount into the designated target currency at the given
   * valuation date, using the provided CurrencyConversionService. If any
   * conversion fails, returns None. Otherwise, returns the total converted
   * value as a Rational.
   */
  public convertTo(target: Currency, provider: CurrencyConversionService, valuationPolicy: ValuationPolicy): Option<Rational> {
    let total: Rational = Rational.ZERO;
    for (const { currency, value } of this.amounts.values()) {
      let converted: Rational;
      if (currency.id === target.id) {
        converted = value;
      } else {
        const convOpt: Option<Rational> = provider.resolveConversion(currency, target, valuationPolicy.valuationDate);
        if (isNone(convOpt)) {
          return None;
        }

        // Multiply the original amount by the conversion rate.
        converted = value.times(convOpt);
      }
      total = total.plus(converted);
    }
    return total;
  }

  /**
   * Determines if this Amount is considered zero.
   *
   * It returns true if either:
   *   - All stored currency values are zero, OR
   *   - When all amounts are converted (using the provided provider and
   *     valuationPolicy) to a target currency (either supplied or derived from
   *     the first nonzero entry), the net total is within the provided
   *     tolerance.
   *
   * The tolerance is a Rational (default is Rational.ZERO) and accounts for
   * minor conversion errors.
   */
  public isZero(
    provider: CurrencyConversionService,
    valuationPolicy: ValuationPolicy,
    tolerance: Rational = Rational.ZERO,
    targetCurrency?: Currency
  ): boolean {
    let target: Currency | undefined = targetCurrency;
    if (!target) {
      // If no target is given, choose the first nonzero currency.
      for (const { currency, value } of this.amounts.values()) {
        if (!value.isZero()) {
          target = currency;
          break;
        }
      }
      // If there is no nonzero entry, the Amount is zero.
      if (!target) {
        return true;
      }
    }
    const convertedOpt = this.convertTo(target, provider, valuationPolicy);
    if (isNone(convertedOpt)) {
      // If any conversion fails, we cannot conclude the amount is zero.
      return false;
    }

    const total: Rational = convertedOpt;
    const absTotal = total.lt(Rational.ZERO) ? total.times(Rational.NEGATIVE_ONE) : total;
    return absTotal.lte(tolerance);
  }

  /**
   * Returns an array of currency/value entries for inspection.
   */
  public getEntries(): { currency: Currency; value: Rational }[] {
    return Array.from(this.amounts.values());
  }

  /**
   * Returns a debug string representation of the Amount (e.g. "1.03 USD, 339 WKHR, -0.1 CAD").
   */
  public toString(): string {
    const parts: string[] = [];
    for (const { currency, value } of this.amounts.values()) {
      parts.push(`${value.toString()} ${currency.id}`);
    }
    return parts.join(", ");
  }

  /**
   * Rounds the underlying rational values of every currency to the given number
   * of decimal places. Returns a new Amount with the rounded values.
   */
  public round(precision: number): Amount {
    const result = new Map<string, { currency: Currency; value: Rational }>();
    for (const [curId, { currency, value }] of this.amounts) {
      const roundedValue = value.round(precision);
      if (!roundedValue.isZero()) {
        result.set(curId, { currency, value: roundedValue });
      }
    }
    return Amount.fromMap(result);
  }
}
