
import { describe, it, expect, test } from 'vitest';
import { Rational } from './rational.ts';

describe('Quantity', () => {
  describe('fromNumber', () => {
    it('should return a Quantity with denominator 1 for integer inputs', () => {
      const testCases = [
        { input: 0, expectedNumerator: 0n, expectedDenom: 1n },
        { input: 1, expectedNumerator: 1n, expectedDenom: 1n },
        { input: -5, expectedNumerator: -5n, expectedDenom: 1n },
        { input: 100, expectedNumerator: 100n, expectedDenom: 1n },
        { input: 212e-12, expectedNumerator: 212n, expectedDenom: 10n ** 12n },
        { input: 1e21, expectedNumerator: BigInt(1e21), expectedDenom: 1n },
      ];

      for (const { input, expectedNumerator, expectedDenom } of testCases) {
        const q = Rational.fromNumber(input);
        expect(q.eq(new Rational(expectedNumerator, expectedDenom))).toEqual(true);
      }
    });

    it('should correctly convert a non-integer decimal to a Quantity', () => {
      const q = Rational.fromNumber(123.456);
      expect(q.toNumber()).toEqual(123.456);
      expect(q.toString()).toEqual("123.456");
    });

    it('should correctly convert negative decimal numbers', () => {
      const q = Rational.fromNumber(-0.125);
      expect(q.toNumber()).toEqual(-0.125);
      expect(q.toString()).toEqual("-0.125");
    });

    it('should correctly handle numbers that use exponential notation (via toPrecision)', () => {
      const input = 1e-10;
      const q = Rational.fromNumber(input);
      expect(q.toNumber()).toBeCloseTo(input, 12);
    });

    it('should accurately convert small decimals triggering the exponential branch', () => {
      const input = 0.000000123456789;
      const q = Rational.fromNumber(input);
      expect(q.toNumber()).toBeCloseTo(input, 17);
    });

    it('should preserve the numeric value when converting to Quantity and back to number', () => {
      const testValues = [0.1, 0.2, 0.3, 12.34, -56.78, 1e-8, 9e7];
      for (const val of testValues) {
        const q = Rational.fromNumber(val);
        expect(q.toNumber()).toBeCloseTo(val, 17);
      }
    });

    it('should throw an error when the input is Infinity', () => {
      expect(() => Rational.fromNumber(Infinity)).toThrow();
    });

    it('should throw an error when the input is -Infinity', () => {
      expect(() => Rational.fromNumber(-Infinity)).toThrow();
    });

    it('should throw an error when the input is NaN', () => {
      expect(() => Rational.fromNumber(NaN)).toThrow();
    });
  });

  describe('Arithmetic operations', () => {
    describe('plus()', () => {
      it('should add two quantities with the same denominator correctly', () => {
        // 1/2 + 1/2 = 2/2 but raw result is (1*2 + 1*2)/(2*2)= (2+2)/4 = 4/4
        const a = new Rational(1n, 2n);
        const b = new Rational(1n, 2n);
        const result = a.plus(b).reduce();
        expect(result.numerator).toBe(1n);
        expect(result.denominator).toBe(1n);
      });

      it('should add two quantities with different denominators correctly', () => {
        // 1/2 + 1/3 = (1*3 + 1*2)/(2*3) = 5/6
        const a = new Rational(1n, 2n);
        const b = new Rational(1n, 3n);
        const result = a.plus(b);
        expect(result.numerator).toBe(5n);
        expect(result.denominator).toBe(6n);
      });

      it('should add a number to a quantity correctly', () => {
        // 1/2 + 0.5 (0.5 => 1/2) should equal 1/2+1/2 = 1
        const a = new Rational(1n, 2n);
        const result = a.plus(0.5);
        expect(result.eq(new Rational(1n, 1n))).toBe(true);
      });

      it('should handle addition that cancels out to zero', () => {
        // 5/7 + (-5/7) should equal 0
        const a = new Rational(5n, 7n);
        const b = new Rational(-5n, 7n);
        const result = a.plus(b);
        expect(result.eq(new Rational(0n, 1n))).toBe(true);
      });

      it('should be commutative', () => {
        // a + b should equal b + a
        const a = new Rational(2n, 5n);
        const b = new Rational(3n, 7n);
        expect(a.plus(b).eq(b.plus(a))).toBe(true);
      });

      it('should correctly add quantities created from floating-point numbers', () => {
        // Using fromNumber to convert decimals: 0.1 + 0.2 should equal 0.3.
        const a = Rational.fromNumber(0.1);
        const b = Rational.fromNumber(0.2);
        const result = a.plus(b);
        expect(result.toNumber()).toBeCloseTo(0.3, 10);
      });
    });

    describe('minus()', () => {
      it('should subtract two quantities correctly', () => {
        // 3/4 - 1/4 = (3*4 - 1*4)/(4*4) = (12-4)/16 = 8/16 which is equivalent to 1/2.
        const a = new Rational(3n, 4n);
        const b = new Rational(1n, 4n);
        const result = a.minus(b).reduce();
        expect(result.numerator).toBe(1n);
        expect(result.denominator).toBe(2n);
      });

      it('should subtract a number from a quantity correctly', () => {
        // 3/4 - 0.25 (0.25 => 1/4) = 3/4 - 1/4 = 2/4
        const a = new Rational(3n, 4n);
        const result = a.minus(0.25);
        expect(result.eq(new Rational(2n, 4n))).toBe(true);
      });

      it('should handle subtraction resulting in a negative value', () => {
        // 1/3 - 2/3 = -1/3
        const a = new Rational(1n, 3n);
        const b = new Rational(2n, 3n);
        const result = a.minus(b);
        expect(result.eq(new Rational(-1n, 3n))).toBe(true);
      });

      it('should subtract a negative number correctly (effectively adding)', () => {
        // 1/2 - (-0.25) equals 1/2 + 1/4 = 3/4
        const a = new Rational(1n, 2n);
        const result = a.minus(-0.25);
        expect(result.eq(new Rational(3n, 4n))).toBe(true);
      });

      it('should correctly handle non-commutative subtraction', () => {
        // Verify that switching operands changes the result appropriately.
        const a = new Rational(5n, 6n);
        const b = new Rational(1n, 2n);
        const result1 = a.minus(b); // 5/6 - 1/2 = 5/6 - 3/6 = 2/6 = 1/3
        const result2 = b.minus(a); // 1/2 - 5/6 = 3/6 - 5/6 = -2/6 = -1/3
        expect(result1.eq(new Rational(1n, 3n))).toBe(true);
        expect(result2.eq(new Rational(-1n, 3n))).toBe(true);
      });
    });

    describe('times()', () => {
      it('should multiply two quantities correctly', () => {
        // (1/2) * (2/3) = (1*2)/(2*3) = 2/6
        const a = new Rational(1n, 2n);
        const b = new Rational(2n, 3n);
        const result = a.times(b);
        expect(result.numerator).toBe(1n);
        expect(result.denominator).toBe(3n);
      });

      it('should multiply a quantity by a number correctly', () => {
        // (3/4) * 2 = (3/4)*(2/1) = 6/4
        const a = new Rational(3n, 4n);
        const result = a.times(2);
        expect(result.eq(new Rational(6n, 4n))).toBe(true);
      });

      it('should handle multiplication with negative quantities', () => {
        // (-3/4) * (2/3) = -6/12
        const a = new Rational(-3n, 4n);
        const b = new Rational(2n, 3n);
        const result = a.times(b);
        expect(result.eq(new Rational(-6n, 12n))).toBe(true);
      });

      it('should multiply two negative quantities to yield a positive result', () => {
        // (-1/2) * (-3/4) = 3/8
        const a = new Rational(-1n, 2n);
        const b = new Rational(-3n, 4n);
        const result = a.times(b);
        expect(result.eq(new Rational(3n, 8n))).toBe(true);
      });

      it('should handle multiplication by zero', () => {
        const a = new Rational(3n, 5n);
        const result = a.times(0);
        expect(result.eq(new Rational(0n, 1n))).toBe(true);
      });
    });

    describe('div()', () => {
      it('should divide two quantities correctly', () => {
        // (1/2) / (2/3) = (1/2)*(3/2)= 3/4
        const a = new Rational(1n, 2n);
        const b = new Rational(2n, 3n);
        const result = a.div(b);
        expect(result.eq(new Rational(3n, 4n))).toBe(true);
      });

      it('should divide a quantity by a number correctly', () => {
        // (3/4) / 2 = (3/4)*(1/2)= 3/8
        const a = new Rational(3n, 4n);
        const result = a.div(2);
        expect(result.eq(new Rational(3n, 8n))).toBe(true);
      });

      it('should handle division with negative quantities', () => {
        // (-1/2) / (2/3) = (-1/2)*(3/2)= -3/4
        const a = new Rational(-1n, 2n);
        const b = new Rational(2n, 3n);
        const result = a.div(b);
        expect(result.eq(new Rational(-3n, 4n))).toBe(true);
      });

      it('should divide by a negative number correctly', () => {
        // (3/4) / (-2) = (3/4)*(-1/2)= -3/8
        const a = new Rational(3n, 4n);
        const result = a.div(-2);
        expect(result.eq(new Rational(-3n, 8n))).toBe(true);
      });

      it('should ensure the resulting denominator is positive when dividing by a negative quantity', () => {
        // (3/4) / (-1/2) = (3/4)*(-2/1)= -6/4; the constructor adjusts the sign so that denominator > 0.
        const a = new Rational(3n, 4n);
        const b = new Rational(-1n, 2n);
        const result = a.div(b);
        expect(result.numerator).toBe(-3n);
        expect(result.denominator).toBe(2n);
      });

      it('should throw an error when division by a zero Quantity is attempted', () => {
        const a = new Rational(1n, 2n);
        expect(() => a.div(new Rational(0n, 1n))).toThrow("Division by zero");
      });

      it('should throw an error when division by zero (as a number) is attempted', () => {
        const a = new Rational(1n, 2n);
        expect(() => a.div(0)).toThrow("Division by zero");
      });
    });

    test('plus: Adding mixed fractions (different denominators)', () => {
      // 1/2 + 2/3 = 3/6 + 4/6 = 7/6
      let q1 = new Rational(1n, 2n);  // 0.5
      let q2 = new Rational(2n, -3n);  // ~0.6667

      let sum = q1.plus(q2).reduce();
      // Should be 7/6
      expect(sum.numerator).toBe(-1n);
      expect(sum.denominator).toBe(6n);

      // eq check:
      expect(sum.eq(new Rational(-1n, 6n))).toBe(true);
      expect(sum.toNumber()).toBeCloseTo(-0.1666666667, 10);

      q1 = new Rational(1n, 2n);  // 0.5
      q2 = new Rational(2n, 3n);  // ~0.6667

      sum = q1.plus(q2).reduce();
      // Should be 7/6
      expect(sum.numerator).toBe(7n);
      expect(sum.denominator).toBe(6n);

      // eq check:
      expect(sum.eq(new Rational(7n, 6n))).toBe(true);
      expect(sum.toNumber()).toBeCloseTo(1.1666666667, 10);
    });

    test('plus: Adding negative number (sign carried in numerator)', () => {
      // -5 + 3.5 => -5 + 7/2 => (-10/2) + (7/2) => -3/2
      const negative = new Rational(-5n, 1n);
      const positiveFraction = Rational.parse('3.5').reduce(); // => 35/10 => 7/2
      const result = negative.plus(positiveFraction); // => (-3/2)

      expect(result.numerator).toBe(-3n);
      expect(result.denominator).toBe(2n);
      expect(result.toNumber()).toBe(-1.5);
    });

    test('minus: Subtracting two integer-based Quantities', () => {
      const q1 = new Rational(10n, 1n);
      const q2 = new Rational(6n, 1n);

      const diff = q1.minus(q2); // 10 - 6 = 4
      expect(diff.numerator).toBe(4n);
      expect(diff.denominator).toBe(1n);
      expect(diff.eq(4)).toBe(true);
    });

    test('minus: Subtracting fractions, expecting negative result', () => {
      // 1/4 - 3/4 = -2/4 => -1/2 after reduce
      const quarter = new Rational(1n, 4n);
      const threeQuarters = new Rational(3n, 4n);

      const diff = quarter.minus(threeQuarters);
      const reduced = diff.reduce();
      expect(reduced.numerator).toBe(-1n);
      expect(reduced.denominator).toBe(2n);
    });

    test('minus: Subtracting zero-literal number', () => {
      const q = new Rational(5n, 2n);  // 2.5
      const diff = q.minus(0).reduce();
      expect(diff.numerator).toBe(5n);
      expect(diff.denominator).toBe(2n);
      expect(diff.toNumber()).toBe(2.5);
    });

    test('times: Multiplying two positive integer Quantities', () => {
      const q1 = new Rational(3n, 1n);
      const q2 = new Rational(4n, 1n);

      const product = q1.times(q2); // 12
      expect(product.numerator).toBe(12n);
      expect(product.denominator).toBe(1n);
      expect(product.eq(12)).toBe(true);
    });

    test('times: Multiplying fractions and checking sign', () => {
      // (-3/4) * (1/2) => -3/8
      const negativeFraction = new Rational(-3n, 4n);
      const half = new Rational(1n, 2n);

      const product = negativeFraction.times(half);
      expect(product.numerator).toBe(-3n);
      expect(product.denominator).toBe(8n);
      expect(product.toNumber()).toBe(-0.375);
    });

    test('times: Multiplying large bigints from parsed strings', () => {
      const q1 = Rational.parse('123456789123456789.3333');  // huge integer
      const q2 = Rational.parse('987654321');           // large integer

      const product = q1.times(q2).reduce();
      // cross-check via BigInt multiplication:
      const expected = 1234567891234567893333n * 987654321n;
      expect(product.numerator).toBe(expected);
      expect(product.denominator).toBe(10000n);
      expect(product.toString({ displayPrecision: 4 })).toBe('121932631234567900441820454.1893');
    });

    test("parsing long DPs", () => {
      expect(Rational.parse("1.1234567890").toString({displayPrecision: 20})).toEqual("1.123456789");
      expect(Rational.parse("1.1234567890").toNumber()).toEqual(1.1234567890);
      expect(Rational.parse("-21.1234567890").toString({displayPrecision: 20})).toEqual("-21.123456789");
      expect(Rational.parse("-21.1234567890").toNumber()).toEqual(-21.1234567890);
    });

    test('div: Dividing two integer-based Quantities', () => {
      const q1 = new Rational(10n, 1n);
      const q2 = new Rational(2n, 1n);

      const quotient = q1.div(q2).reduce(); // 10 / 2 = 5
      expect(quotient.numerator).toBe(5n);
      expect(quotient.denominator).toBe(1n);
      expect(quotient.eq(5)).toBe(true);
    });

    test('div: Dividing by zero should throw', () => {
      const q1 = new Rational(10n, 1n);
      const q2 = new Rational(0n, 1n);

      expect(() => q1.div(q2)).toThrow('Division by zero');
    });

    test('div: Dividing two fractions, negative result', () => {
      // (-3/4) / (1/2) => (-3/4) * (2/1) => -6/4 => -3/2
      const negativeFraction = new Rational(-3n, 4n);
      const half = new Rational(1n, 2n);

      const quotient = negativeFraction.div(half);
      expect(quotient.numerator).toBe(-3n);
      expect(quotient.denominator).toBe(2n);

      // Reduced form is -3/2
      const reduced = quotient.reduce();
      expect(reduced.numerator).toBe(-3n);
      expect(reduced.denominator).toBe(2n);
    });

    test('div: Large bigints from parsed strings', () => {
      const q1 = Rational.parse('99999999999999999999');
      const q2 = Rational.parse('3');

      const quotient = q1.div(q2).reduce();
      const expected = 99999999999999999999n / 3n;
      expect(quotient.numerator).toBe(expected);
      expect(quotient.denominator).toBe(1n);
    });

    test('Mixed usage: times + plus in a chain', () => {
      // 3/2 * 4/3 + 5 => (3/2)*(4/3) = 4/2 = 2 => 2 + 5 = 7
      const q1 = new Rational(3n, 2n); // 1.5
      const q2 = new Rational(4n, 3n); // ~1.3333
      const chain = q1.times(q2).plus(5).reduce();

      expect(chain.numerator).toBe(7n);
      expect(chain.denominator).toBe(1n);
      expect(chain.eq(new Rational(7n, 1n))).toBe(true);
    });

    test('Mixed usage: plus + minus + times + div in a single expression', () => {
      // Let’s do: (1.2 + 3) - (1/6) * (9.6 / 4)
      // Step by step:
      // 1.2 + 3 => 4.2
      // 9.6 / 4 => 2.4
      // (1/6) * 2.4 => 2.4/6 => 0.4
      // => 4.2 - 0.4 = 3.8

      const onePointTwo = Rational.fromNumber(1.2);  // => 12/10
      const three = Rational.fromNumber(3);          // => 3/1
      const ninePointSix = Rational.fromNumber(9.6); // => 96/10
      const four = Rational.fromNumber(4);           // => 4/1
      const oneSixth = new Rational(1n, 6n);   // => 1/6

      // (1.2 + 3) = 4.2
      const step1 = onePointTwo.plus(three);
      // (9.6 / 4) = 2.4
      const step2 = ninePointSix.div(four);
      // (1/6) * 2.4 = 0.4
      const step3 = oneSixth.times(step2);
      // 4.2 - 0.4 = 3.8
      const result = step1.minus(step3);

      expect(result.toNumber()).toBe(3.8);

      // Let's ensure the fraction form is correct:
      // 1.2 => 12/10, 3 => 3/1 => sum => 12/10 + 30/10 = 42/10 => 21/5
      // 9.6 => 96/10, 4 => 4/1 => div => (96/10) / (4/1) => 96/10 * 1/4 => 96/40 => 24/10 => 12/5
      // (1/6) => 1/6 => times => (12/5) => (1/6)*(12/5) => 12/30 => 2/5 => 0.4
      // (21/5) - (2/5) => 19/5 => 3.8
      // Check final fraction:
      const fractionForm = result.reduce();
      expect(fractionForm.numerator).toBe(19n);
      expect(fractionForm.denominator).toBe(5n);
    });

    test('Denominator sign correction: ensuring sign is only carried by numerator', () => {
      // We will create a quantity with a negative denominator. We expect it to be normalized
      // so that the numerator is negative, denominator is positive.
      const tricky = new Rational(5n, -3n);
      expect(tricky.numerator).toBe(-5n);
      expect(tricky.denominator).toBe(3n);
    });

    test('Ensure cross-multiplication eq check works as intended (denominator differences)', () => {
      // 3/4 ?= 6/8 => they should be equal numerically, but the code checks with cross multiplication
      const qA = new Rational(3n, 4n);
      const qB = new Rational(6n, 8n);

      expect(qA.eq(qB)).toBe(true);
      expect(qA.valueOf()).toBe('0.75');

      // Also check that a difference is recognized:
      const qC = new Rational(75n, 100n); // 0.75
      expect(qB.eq(qC)).toBe(true);

      const qD = new Rational(76n, 100n); // 0.76
      expect(qB.eq(qD)).toBe(false);
    });
  });

  test('toString removes trailing zeros in fractional part and always leaves at least one digit', () => {
    // Create an integer Quantity so that after rounding the fractional part is all zeros.
    // With default display precision (10), we expect "5.0" instead of "5.".
    const qInteger = new Rational(5n, 1n);
    expect(qInteger.toString()).toBe("5.0");

    // Test with a custom display precision.
    // Even if we ask for a lower precision (e.g., 4), an integer value should yield "5.0"
    expect(qInteger.toString({ displayPrecision: 4 })).toBe("5.0");

    expect(qInteger.toString({ displayPrecision: 0 })).toBe("5");

    // Test with a negative integer.
    const qNegInteger = new Rational(-123n, 1n);
    expect(qNegInteger.toString({ displayPrecision: 6 })).toBe("-123.0");

    // Also, verify that when the fractional part is not all zeros,
    // the trailing zero removal only trims extra zeros.
    // For instance, 12.3400 should become "12.34" after trailing zero removal.
    const qFraction = new Rational(123400n, 10000n); // 12.34 exactly

    expect(qFraction.toString({ displayPrecision: 4 })).toBe("12.34");
  });

  test('toString returns the same result as valueOf', () => {
    const q = Rational.fromNumber(3.14159);
    expect(q.toString()).toBe(q.valueOf());
  });

  test('Constructor throws an error when denominator is zero', () => {
    expect(() => new Rational(1n, 0n)).toThrow("Denominator cannot be zero.");
  });

  describe('Rounding Tests (should mimic JavaScript Math.round behavior)', () => {
    test('round: rounds positive number exactly at half upward', () => {
      const q = Rational.fromNumber(1.45);
      expect(q.round(1).toNumber()).toBe(1.5);
      expect(q.round(0).toNumber()).toBe(1);
      expect(q.plus(0.1).round(0).toNumber()).toBe(2);
    });

    test('round: rounds positive number with non-half fractional part', () => {
      const q = Rational.fromNumber(1.23);
      expect(q.round(1).toNumber()).toBe(1.2);
    });

    test('round: rounds negative number exactly at half upward (toward +0) or below half', () => {
      const q = Rational.fromNumber(-1.75);
      expect(q.round(1).toNumber()).toBe(-1.8);
      expect(q.round(0).toNumber()).toBe(-2);
      const q2= Rational.fromNumber(-1.24);
      expect(q2.round(1).toNumber()).toBe(-1.2);
      expect(q2.round(0).toNumber()).toBe(-1);
    });

    test('round: rounds negative number with non-half fractional part correctly', () => {
      const q = Rational.fromNumber(-1.46);
      expect(q.round(1).toNumber()).toBe(-1.5);
      expect(q.round(0).toNumber()).toBe(-1);
      expect(q.round(5).toNumber()).toBe(-1.46);
      expect(q.round(2).toNumber()).toBe(-1.46);
    });

    test('round: returns zero when quantity is zero regardless of precision', () => {
      const q = Rational.fromNumber(0);
      expect(q.round(3).toNumber()).toBe(0);
    });
  });
});
