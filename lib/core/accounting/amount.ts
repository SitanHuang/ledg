import { Currency } from "../valuation/currency.ts";
import { Rational, RationalFormatOptions } from "../math/rational.ts";
import { Option, None, isNone } from "../types.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { CurrencyConversionService } from "../valuation/currencyConversionService.ts";

export type CurrencyCodeDiplayLocation = 'left' | 'right' | 'none';

export class AmountFormatOptions implements RationalFormatOptions {
  minFractionDigits = 2;
  useGrouping = 3;
  groupSeparator = ',';
  decimalSeparator = '.';
  displayPrecision = 5;

  nullPlaceholder = '0';

  currencyCodeLocation: CurrencyCodeDiplayLocation = 'right';

  showPlus = false;

  protected readonly currencyOverrides = new Map<string, AmountFormatOptions>();

  constructor(opts: RationalFormatOptions = {}) {
    Object.assign(this, opts);
  }

  overrideCurrency(currency: Currency, opts: AmountFormatOptions): this {
    this.currencyOverrides.set(currency.id, opts);
    return this;
  }

  getPolicy(currency: Currency): AmountFormatOptions {
    return this.currencyOverrides.get(currency.id) ?? this.naiveCopy();
  }

  naiveCopy(): AmountFormatOptions {
    return new AmountFormatOptions(this);
  }
}

export interface DisplayContentEntry {
  displayedString: string;
  rational: Rational;
  currencyCode: string | null;
}

/**
 * Represents a multi-currency monetary amount. Internally, amounts are stored
 * as a map keyed by currency id.
 */
export class Amount {
  public sourceString?: string;

  private constructor(
    private readonly amounts: ReadonlyMap<string, { currency: Currency; value: Rational }>,
    /**
     * When user leaves empty, it is "".
     *
     * When Amount is dynamically created, it is undefined.
     */
    sourceString?: string
  ) {
    this.sourceString = sourceString;
  }

  public static ZERO: Amount = new Amount(new Map());

  /**
   * Helper to create an Amount instance. It takes an optional array of entries
   * (currency/value pairs) and filters out zero-valued entries.
   */
  public static create(entries: readonly { currency: Currency; value: Rational }[] = [], sourceString?: string): Amount {
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

  public convertToAmount(target: Currency, provider: CurrencyConversionService, valuationPolicy: ValuationPolicy): Option<this> {
    const result = this.convertTo(target, provider, valuationPolicy);

    if (isNone(result)) {
      return result;
    }

    const map = new Map<string, { currency: Currency; value: Rational }>();
    map.set(target.id, { currency: target, value: result });

    return Amount.fromMap(map, this.sourceString);
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

  public isZeroDescriptive(
    provider: CurrencyConversionService,
    valuationPolicy: ValuationPolicy,
    tolerance: Rational = Rational.ZERO,
    targetCurrency?: Currency
  ): true | Error | Amount {
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
      return new Error(`Conversion to "${target.id}" failed.`);
    }

    const total: Rational = convertedOpt;
    const absTotal = total.lt(Rational.ZERO) ? total.times(Rational.NEGATIVE_ONE) : total;
    return absTotal.lte(tolerance) || Amount.create([
      { currency: target, value: absTotal },
    ]);
  }

  /**
   * Returns true only if all amounts zero strictly zero.
   */
  public isStrictlyZero(): boolean {
    for (const entry of this.amounts.values()) {
      if (!entry.value.isZero()) {
        return false;
      }
    }
    return true;
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
  public toString(options?: RationalFormatOptions | AmountFormatOptions): string {
    return this.toContentsArray(options).map(x => x.displayedString).join(", ");
  }

  public toContentsArray(options?: RationalFormatOptions | AmountFormatOptions): DisplayContentEntry[] {
    const parts: DisplayContentEntry[] = [];
    for (const { currency, value } of this.amounts.values()) {
      if (options instanceof AmountFormatOptions) {
        const formatOpts = options.getPolicy(currency);
        const amtString = value.toString(options);
        const contentEntry: DisplayContentEntry = {
          rational: value,
          currencyCode: currency.id,
          displayedString: amtString
        };
        switch (formatOpts.currencyCodeLocation) {
          case "left":
            contentEntry.displayedString = `${currency.id} ${amtString}`;
            break;
          case "right":
            contentEntry.displayedString = `${amtString} ${currency.id}`;
            break;
          case "none":
            contentEntry.displayedString = amtString;
            break;
        }

        parts.push(contentEntry);
      } else {
        parts.push({
          rational: value,
          currencyCode: currency.id,
          displayedString: `${value.toString(options)} ${currency.id}`,
        });
      }
    }

    if (options instanceof AmountFormatOptions && parts.length == 0) {
      parts.push({
        rational: Rational.ZERO,
        currencyCode: null,
        displayedString: options.nullPlaceholder,
      });
    }

    return parts;
  }

  /**
   * Returns the precise, fractional value and the currency id for each
   * currency, sorted alphebetically by curreny id.
   */
  public toFractionString(): string {
    const parts: string[] = [];
    const sortedKeys = Array.from(this.amounts.keys()).sort();
    for (let i = 0; i < sortedKeys.length; i++) {
      const { currency, value } = this.amounts.get(sortedKeys[i])!;
      parts.push(`${value.toFractionString()} ${currency.id}`);
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

  /**
   * Compares this Amount with another *strictly* by the per‑currency magnitudes
   * that are already present in the two Amounts (no conversions, no rounding).
   *
   * ‑1 → this  <  other
   *  0 → equal
   *  1 → this  >  other
   *
   * Ordering is defined deterministically by ascending currency id so that the
   * result is stable even when two Amount instances contain disjoint sets of
   * currencies.
   *
   * Complexity: O(k) where k = |currencies(this) ∪ currencies(other)|.
   * The method allocates only one `string[]` (the union key list) and touches
   * each underlying `Rational` exactly once, which is about as cheap as a
   * “naive” compare can be for millions of postings.
   */
  public naiveCompareTo(other: Amount): number {
    // Fast path: identical reference ⇒ equal.
    if (this === other) {
      return 0;
    }

    // Build the union of currency ids that appear in either instance.
    const keysSet = new Set<string>();
    for (const k of this.amounts.keys()) keysSet.add(k);
    for (const k of other.amounts.keys()) keysSet.add(k);

    // Deterministic traversal order (important for stable ordering).
    const keys = Array.from(keysSet);
    keys.sort((a, b) => a.localeCompare(b)); // radix‑sort–like speed for short ASCII ids.

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      // Get the Rational values or fall back to ZERO for missing currencies.
      const a = this.amounts.get(key)?.value ?? Rational.ZERO;
      const b = other.amounts.get(key)?.value ?? Rational.ZERO;

      const cmp = a.compareTo(b);
      if (cmp !== 0) {
        return cmp; // first non‑equal currency decides
      }
    }
    return 0; // all currency magnitudes equal
  }

}
