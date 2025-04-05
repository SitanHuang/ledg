interface RationalFormatOptions {
  displayPrecision?: number; // number of decimal places for display (default is 10)
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
      const denominator: bigint = this.scale(fractionalPart.length);
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
  public round(precision: number): Rational {
    const factor: bigint = Rational.scale(precision);
    // Multiply numerator by factor, then divide by the denominator with rounding.
    const scaled: bigint = this.numerator * factor;
    const halfDenom: bigint = this.denominator / 2n;
    const rounded: bigint = this.numerator >= 0n
      ? (scaled + halfDenom) / this.denominator
      : (scaled - halfDenom) / this.denominator;
    return new Rational(rounded, factor);
  }

  public toNumber(): number {
    return Number(this.numerator) / Number(this.denominator);
  }

  public valueOf(options?: RationalFormatOptions): string {
    const dp: number = options?.displayPrecision ?? 10;
    // Round to the desired precision so that the denominator becomes 10^dp.
    const q: Rational = this.round(dp);
    const absNum: bigint = q.numerator < 0n ? -q.numerator : q.numerator;
    // Ensure we have at least dp+1 digits.
    const s: string = absNum.toString().padStart(dp + 1, '0');
    const intPart: string = s.slice(0, s.length - dp);
    const sign: string = q.numerator < 0n ? "-" : "";
    // If display precision is 0, return just the integer part without a decimal point.
    if (dp === 0) {
      return sign + intPart;
    } else {
      let fracPart: string = s.slice(s.length - dp);
      // Remove any trailing zeros but always leave at least one digit.
      fracPart = fracPart.replace(/0+$/, "");
      if (fracPart === "") {
        fracPart = "0";
      }

      return sign + intPart + "." + fracPart;
    }
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

  /**
   * Returns 10^precision as a bigint.
   * @param precision The number of decimal places.
   */
  private static scale(precision: number): bigint {
    return BigInt(Math.pow(10, precision));
  }

  /**
   * Helper method that compares this Rational with another.
   * Returns -1 if this < other, 0 if equal, and 1 if this > other.
   * Uses cross-multiplication to avoid floating point inaccuracies.
   */
  private compareTo(other: Rational): number {
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
}