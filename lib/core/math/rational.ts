export interface RationalFormatOptions {
  /** Minimum digits after the decimal point (default = 1).            */
  minFractionDigits?: number;
  /** Insert thousands grouping separators? (default = 0).          */
  useGrouping?: number;
  /** Character used for the thousands separator (default = ",").      */
  groupSeparator?: string;
  /** Character used for the decimal separator   (default = ".").      */
  decimalSeparator?: string;

  /** Maximum digits after the decimal point; value is rounded to this
  *  precision (default = 10).                                         */
  displayPrecision?: number;

  /** Shows plus sign for positive numbers. Default=false. */
  showPlus?: boolean;

  /**
  * When set to true, features unsupported by amount parsing will be ignored.
  */
  forceSerializable?: boolean;
}

export class Rational {
  public readonly numerator: bigint; // Sign carrier
  public readonly denominator: bigint;

  public static ZERO = new Rational(0n, 1n);
  public static ONE = new Rational(1n, 1n);
  public static NEGATIVE_ONE = new Rational(-1n, 1n);

  public constructor(numerator: bigint, denominator = 1n) {
    if (denominator === 0n) {
      throw new Error("Denominator cannot be zero.");
    }

    // Ensure denominator is positive. (Sign is carried by the numerator.)
    const sign: bigint = denominator < 0n ? -1n : 1n;
    this.numerator = numerator * sign;
    this.denominator = denominator * sign;
  }

  /**
   * Creates a Rational from a number.
   * If the number is an integer, a fast path is used.
   * Otherwise, the number is converted to a string and processed similarly
   * to parse, determining the denominator from the count of digits after the decimal.
   * No rounding is performed.
   * @param value The number to convert.
   */
  public static fromNumber(value: number): Rational {
    if (Number.isInteger(value)) {
      return new Rational(BigInt(value), 1n);
    }
    let s: string = value.toString();

    // Handle exponential notation
    if (s.includes('e')) {
      s = value.toFixed(17);
    }

    const dotIndex: number = s.indexOf('.');
    if (dotIndex === -1) {
      // No decimal point, treat as an integer.
      return new Rational(BigInt(s), 1n);
    }

    // Split the number at the decimal point.
    const integerPart: string = s.substring(0, dotIndex);
    const fractionalPart: string = s.substring(dotIndex + 1);
    const denominator = BigInt(10 ** fractionalPart.length);
    const combined: string = integerPart + fractionalPart;

    return new Rational(BigInt(combined), denominator);
  }

  /**
   * Parses a string (like "123.456") into a Rational.
   * The denominator is determined solely from the number of decimal places provided in the string.
   * For example, "123.45" becomes numerator=12345 and denominator=100.
   * @param str The string representation.
   */
  public static parse(str: string): Rational {
    const dotIndex: number = str.indexOf('.');
    if (dotIndex === -1) {
      // No decimal point: denominator is 1.
      return new Rational(BigInt(str), 1n);
    } else {
      const integerPart: string = str.substring(0, dotIndex);
      const fractionalPart: string = str.substring(dotIndex + 1);
      const denominator: bigint = this.scale(BigInt(fractionalPart.length));
      const numerator = BigInt(integerPart + fractionalPart);
      return new Rational(numerator, denominator);
    }
  }

  public plus(other: Rational | number): Rational {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    // (a/b + c/d) = (ad + bc) / bd
    return new Rational(
      this.numerator * q.denominator + q.numerator * this.denominator,
      this.denominator * q.denominator
    ).reduce(); // `reduce` improves performance by 4.5 times
  }

  public minus(other: Rational | number): Rational {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    return new Rational(
      this.numerator * q.denominator - q.numerator * this.denominator,
      this.denominator * q.denominator
    ).reduce();
  }

  public times(other: Rational | number): Rational {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    return new Rational(
      this.numerator * q.numerator,
      this.denominator * q.denominator
    ).reduce();
  }

  public div(other: Rational | number): Rational {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    if (q.numerator === 0n) {
      throw new Error("Division by zero");
    }
    return new Rational(
      this.numerator * q.denominator,
      this.denominator * q.numerator
    ).reduce();
  }

  public eq(other: Rational | number): boolean {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    // Cross-multiply to compare without reducing.
    return this.numerator * q.denominator === q.numerator * this.denominator;
  }

  public isZero(): boolean {
    return this.numerator === 0n;
  }

  /**
   * Rounds this Rational to the given number of decimal places.
   * The rounding is performed in a fixed-point style.
   */
  public round(precision: number | bigint): Rational {
    const factor: bigint = Rational.scale(BigInt(precision));
    // Multiply numerator by factor, then divide by the denominator with rounding.
    const scaled: bigint = this.numerator * factor;
    const halfDenom: bigint = this.denominator / 2n;
    const rounded: bigint = this.numerator >= 0n
      ? (scaled + halfDenom) / this.denominator
      : (scaled - halfDenom) / this.denominator;
    return new Rational(rounded, factor);
  }

  public floor(precision: number | bigint = 0): Rational {
    const factor: bigint = Rational.scale(BigInt(precision));
    const scaled: bigint = this.numerator * factor;

    let q: bigint = scaled / this.denominator;   // truncated toward 0
    const r: bigint = scaled % this.denominator; // remainder

    // If negative and not already exact, step one farther from 0
    if (r !== 0n && this.numerator < 0n) q -= 1n;

    return new Rational(q, factor);
  }

  public ceil(precision: number | bigint = 0): Rational {
    const factor: bigint = Rational.scale(BigInt(precision));
    const scaled: bigint = this.numerator * factor;

    let q: bigint = scaled / this.denominator;   // truncated toward 0
    const r: bigint = scaled % this.denominator; // remainder

    // If positive and not already exact, step one farther from 0
    if (r !== 0n && this.numerator > 0n) q += 1n;

    return new Rational(q, factor);
  }

  public toNumber(): number {
    return Number(this.numerator) / Number(this.denominator);
  }

  public valueOf({
    displayPrecision = 10,
    minFractionDigits = 1,
    useGrouping = 0,
    groupSeparator = ",",
    decimalSeparator = ".",
    showPlus = false,
    forceSerializable = false,
  }: RationalFormatOptions = {}): string {

    if (forceSerializable) {
      useGrouping = 0;
      groupSeparator = '';
      decimalSeparator = '.';
    }

    if (displayPrecision === Infinity) {
      return this.toFractionString();
    }

    const maxFrac = displayPrecision;
    const minFrac = Math.min(maxFrac, minFractionDigits);

    // Round to maxFrac decimal places
    const q = this.round(maxFrac);
    const neg = q.numerator < 0n;
    const absNum = neg ? -q.numerator : q.numerator;

    const raw = absNum.toString().padStart(maxFrac + 1, "0");
    const splitIndex = raw.length - maxFrac;
    const intPartRaw = raw.slice(0, splitIndex);
    let fracPart = raw.slice(splitIndex);

    if (maxFrac > 0) {
      // trim trailing zeros but keep ≥ minFrac
      let trimTo = fracPart.length;
      while (trimTo > minFrac && fracPart[trimTo - 1] === '0')
        --trimTo;
      fracPart = fracPart.slice(0, trimTo);

      // pad if we are still short
      while (fracPart.length < minFrac) fracPart += "0";
    }

    // Grouping:
    let intPart = intPartRaw;
    if (useGrouping > 0 && intPartRaw.length > useGrouping) {
      const buf: string[] = [];
      let count = 0;
      for (let i = intPartRaw.length - 1; i >= 0; --i) {
        buf.push(intPartRaw[i]);
        if (++count === useGrouping && i !== 0) {
          buf.push(groupSeparator);
          count = 0;
        }
      }
      buf.reverse();
      intPart = buf.join("");
    }

    const sign = neg ? "-" : (showPlus ? "+" : "");
    if (maxFrac === 0) return sign + intPart;
    if (fracPart.length == 0) return sign + intPart;
    return sign + intPart + decimalSeparator + fracPart;
  }

  /**
   * Returns a new Rational with the fraction reduced by dividing both numerator and denominator by their GCD.
   */
  public reduce(): Rational {
    let a = this.numerator;
    let b = this.denominator;

    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    const divisor = a < 0n ? -a : a;

    return new Rational(this.numerator / divisor, this.denominator / divisor);
  }

  public toString(options?: RationalFormatOptions): string {
    return this.valueOf(options);
  }

  public toFractionString(): string {
    const reduced = this.reduce();
    return reduced.numerator.toString(10) + ' / ' + reduced.denominator.toString(10);
  }

  /**
   * Returns 10^precision as a bigint.
   * @param precision The number of decimal places.
   */
  private static scale(precision: bigint): bigint {
    return 10n ** precision;
  }

  /**
   * Compares this Rational with another.
   * Returns -1 if this < other, 0 if equal, and 1 if this > other.
   * Uses cross-multiplication to avoid floating point inaccuracies.
   */
  public compareTo(other: Rational): number {
    const diff = this.numerator * other.denominator - other.numerator * this.denominator;
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }

  /**
   * Returns true if this Rational is less than the other.
   */
  public lt(other: Rational | number): boolean {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    return this.compareTo(q) < 0;
  }

  /**
   * Returns true if this Rational is greater than the other.
   */
  public gt(other: Rational | number): boolean {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    return this.compareTo(q) > 0;
  }

  /**
   * Returns true if this Rational is less than or equal to the other.
   */
  public lte(other: Rational | number): boolean {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    return this.compareTo(q) <= 0;
  }

  /**
   * Returns true if this Rational is greater than or equal to the other.
   */
  public gte(other: Rational | number): boolean {
    const q: Rational = typeof other === "number" ? Rational.fromNumber(other) : other;
    return this.compareTo(q) >= 0;
  }

  public pow(exponent: bigint): Rational {
    if (exponent === 0n) {
      return Rational.ONE;
    }

    // Positive exponent: raise numerator and denominator
    if (exponent > 0n) {
      const newNum = this.numerator ** exponent;
      const newDen = this.denominator ** exponent;
      return new Rational(newNum, newDen).reduce();
    }

    // Negative exponent: reciprocal
    if (this.numerator === 0n) {
      throw new Error("Zero cannot be raised to a negative power.");
    }
    const posExp = -exponent;
    const recNum = this.denominator ** posExp;
    const recDen = this.numerator ** posExp;
    return new Rational(recNum, recDen).reduce();
  }

  public static max(r1: Rational, r2: Rational): Rational {
    return r2.gt(r1) ? r2 : r1;
  }

  public static min(r1: Rational, r2: Rational): Rational {
    return r2.lt(r1) ? r2 : r1;
  }

  public static abs(r1: Rational): Rational {
    return new Rational(r1.numerator < 0n ? -r1.numerator : r1.numerator, r1.denominator);
  }
}