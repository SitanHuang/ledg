
import { describe, it, expect } from 'vitest';
import { Quantity } from './quantity.ts';

describe('Quantity', () => {
  describe('fromNumber', () => {
    it('should return a Quantity with denominator 1 for integer inputs', () => {
      const testCases = [
        { input: 0, expectedNumerator: 0n, expectedDenom: 1n },
        { input: 1, expectedNumerator: 1n, expectedDenom: 1n },
        { input: -5, expectedNumerator: -5n, expectedDenom: 1n },
        { input: 100, expectedNumerator: 100n, expectedDenom: 1n },
        { input: 1e21, expectedNumerator: BigInt(1e21), expectedDenom: 1n },
      ];

      for (const { input, expectedNumerator, expectedDenom } of testCases) {
        const q = Quantity.fromNumber(input);
        expect(q.numerator).toEqual(expectedNumerator);
        expect(q.denominator).toEqual(expectedDenom);
      }
    });

    it('should correctly convert a non-integer decimal to a Quantity', () => {
      const q = Quantity.fromNumber(123.456);
      expect(q.numerator).toEqual(123456n);
      expect(q.denominator).toEqual(1000n);
    });

    it('should correctly convert negative decimal numbers', () => {
      const q = Quantity.fromNumber(-0.125);
      expect(q.numerator).toEqual(-125n);
      expect(q.denominator).toEqual(1000n);
    });

    it('should correctly handle numbers that use exponential notation (via toPrecision)', () => {
      const input = 1e-10;
      const q = Quantity.fromNumber(input);
      expect(q.toNumber()).toBeCloseTo(input, 12);
    });

    it('should accurately convert small decimals triggering the exponential branch', () => {
      const input = 0.000000123456789;
      const q = Quantity.fromNumber(input);
      expect(q.toNumber()).toBeCloseTo(input, 17);
    });

    it('should preserve the numeric value when converting to Quantity and back to number', () => {
      const testValues = [0.1, 0.2, 0.3, 12.34, -56.78, 1e-8, 9e7];
      for (const val of testValues) {
        const q = Quantity.fromNumber(val);
        expect(q.toNumber()).toBeCloseTo(val, 17);
      }
    });

    it('should throw an error when the input is Infinity', () => {
      expect(() => Quantity.fromNumber(Infinity)).toThrow();
    });

    it('should throw an error when the input is -Infinity', () => {
      expect(() => Quantity.fromNumber(-Infinity)).toThrow();
    });

    it('should throw an error when the input is NaN', () => {
      expect(() => Quantity.fromNumber(NaN)).toThrow();
    });
  })
});
