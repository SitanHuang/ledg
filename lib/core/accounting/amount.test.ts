import { describe, it, expect } from 'vitest';
import { Amount } from './amount.ts';
import { Rational } from '../math/rational.ts';
import { Currency } from '../math/currency.ts';
import { ValuationPolicy } from '../valuation/policy.ts';
import { None } from '../types.ts';
import { CurrencyProviderService } from '../valuation/currencyProviderService.ts';

const USD = new Currency("USD");
const CAD = new Currency("CAD");
const EUR = new Currency("EUR");

const r = (n: number) => Rational.fromNumber(n);

class DummyCurrencyProviderService extends CurrencyProviderService {
  private conversions: Map<string, Rational>;
  constructor(conversions: { from: Currency; to: Currency; rate: Rational }[]) {
    super();
    this.conversions = new Map();
    for (const conv of conversions) {
      this.conversions.set(`${conv.from.id}->${conv.to.id}`, conv.rate);
    }
  }
  resolveConversion(from: Currency, to: Currency, timestamp: number): typeof None | Rational {
    if (from.id === to.id) return Rational.ONE;
    const key = `${from.id}->${to.id}`;
    return this.conversions.get(key) || None;
  }
}

describe('Amount', () => {
  describe('Creation', () => {
    it('should create a zero amount when no entries are provided', () => {
      const amt = Amount.create();
      expect(amt).toEqual(Amount.ZERO);
      expect(amt.getEntries()).toEqual([]);
    });

    it('should filter out zero-valued entries', () => {
      const amt = Amount.create([
        { currency: USD, value: r(0) },
        { currency: CAD, value: r(100) },
        { currency: EUR, value: r(0) },
      ]);
      const entries = amt.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].currency.id).toBe(CAD.id);
      expect(entries[0].value.eq(r(100))).toBe(true);
    });

    it('should create an amount with multiple nonzero currencies', () => {
      const amt = Amount.create([
        { currency: USD, value: new Rational(23970n, 3n) },
        { currency: USD, value: new Rational(5n, 6n) },
        { currency: USD, value: new Rational(3n, 1n) },
        { currency: USD, value: new Rational(-5n, 6n) },
        { currency: CAD, value: r(-20) },
      ]);
      const entries = amt.getEntries();
      expect(entries.length).toBe(2);
      const usdEntry = entries.find(e => e.currency.id === USD.id);
      const cadEntry = entries.find(e => e.currency.id === CAD.id);
      expect(usdEntry).toBeDefined();
      expect(cadEntry).toBeDefined();
      expect(usdEntry!.value.eq(new Rational(7993n, 1n))).toBe(true);
      expect(cadEntry!.value.eq(r(-20))).toBe(true);
    });
  });

  describe('Arithmetic operations', () => {
    it('plus: should sum amounts with the same currency', () => {
      const amt1 = Amount.create([{ currency: USD, value: r(5) }]);
      const amt2 = Amount.create([{ currency: USD, value: r(3) }]);
      const result = amt1.plus(amt2);
      const entries = result.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].currency.id).toBe(USD.id);
      expect(entries[0].value.eq(r(8))).toBe(true);
    });

    it('plus: should combine amounts in different currencies', () => {
      const amt1 = Amount.create([{ currency: USD, value: r(5) }]);
      const amt2 = Amount.create([{ currency: CAD, value: r(3) }]);
      const result = amt1.plus(amt2);
      const entries = result.getEntries();
      expect(entries.length).toBe(2);
      const usdEntry = entries.find(e => e.currency.id === USD.id);
      const cadEntry = entries.find(e => e.currency.id === CAD.id);
      expect(usdEntry).toBeDefined();
      expect(cadEntry).toBeDefined();
      expect(usdEntry!.value.eq(r(5))).toBe(true);
      expect(cadEntry!.value.eq(r(3))).toBe(true);
    });

    it('plus: should cancel out currencies when the sum is zero', () => {
      const amt1 = Amount.create([{ currency: USD, value: r(5) }]);
      const amt2 = Amount.create([{ currency: USD, value: r(-5) }]);
      const result = amt1.plus(amt2);
      expect(result.getEntries().length).toBe(0);
      expect(result).toEqual(Amount.ZERO);
    });

    it('plus: adding ZERO should yield the original amount', () => {
      const amt = Amount.create([{ currency: EUR, value: r(10) }]);
      const result = amt.plus(Amount.ZERO);
      const entries = result.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].currency.id).toBe(EUR.id);
      expect(entries[0].value.eq(r(10))).toBe(true);
    });

    it('minus: should subtract amounts correctly', () => {
      const amt1 = Amount.create([{ currency: USD, value: r(10) }]);
      const amt2 = Amount.create([{ currency: USD, value: r(3) }]);
      const result = amt1.minus(amt2);
      const entries = result.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].currency.id).toBe(USD.id);
      expect(entries[0].value.eq(r(7))).toBe(true);
    });

    it('minus: should subtract amounts across different currencies correctly', () => {
      const amt1 = Amount.create([
        { currency: USD, value: r(10) },
        { currency: CAD, value: r(-4) },
      ]);
      const amt2 = Amount.create([
        { currency: USD, value: r(3) },
        { currency: CAD, value: r(-2) },
      ]);
      const result = amt1.minus(amt2);
      // Expected: USD: 10 - 3 = 7; CAD: -4 - (-2) = -2.
      const entries = result.getEntries();
      expect(entries.length).toBe(2);
      const usdEntry = entries.find(e => e.currency.id === USD.id);
      const cadEntry = entries.find(e => e.currency.id === CAD.id);
      expect(usdEntry).toBeDefined();
      expect(cadEntry).toBeDefined();
      expect(usdEntry!.value.eq(r(7))).toBe(true);
      expect(cadEntry!.value.eq(r(-2))).toBe(true);
    });

    it('times: should multiply each currency value by the factor', () => {
      const amt = Amount.create([
        { currency: USD, value: r(2) },
        { currency: CAD, value: r(-3) },
      ]);
      const factor = r(3);
      const result = amt.times(factor);
      const entries = result.getEntries();
      expect(entries.length).toBe(2);
      const usdEntry = entries.find(e => e.currency.id === USD.id);
      const cadEntry = entries.find(e => e.currency.id === CAD.id);
      expect(usdEntry!.value.eq(r(6))).toBe(true);
      expect(cadEntry!.value.eq(r(-9))).toBe(true);
    });

    it('times: multiplying by zero yields ZERO', () => {
      const amt = Amount.create([
        { currency: USD, value: r(5) },
        { currency: CAD, value: r(10) },
      ]);
      const result = amt.times(r(0));
      expect(result).toEqual(Amount.ZERO);
      expect(result.getEntries().length).toBe(0);
    });

    it('div: should divide each currency value by the divisor', () => {
      const amt = Amount.create([{ currency: USD, value: r(10) }]);
      const result = amt.div(r(2));
      const entries = result.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].value.eq(r(5))).toBe(true);
    });

    it('div: dividing by a negative scalar inverts the sign', () => {
      const amt = Amount.create([{ currency: CAD, value: r(10) }]);
      const result = amt.div(r(-2));
      const entries = result.getEntries();
      expect(entries.length).toBe(1);
      expect(entries[0].value.eq(r(-5))).toBe(true);
    });
  });

  describe('Conversion', () => {
    const valuationDate = 1000;
    const policy = new ValuationPolicy(valuationDate);
    const conversionRates = [
      { from: CAD, to: USD, rate: r(0.8) },
      { from: USD, to: CAD, rate: r(1.25) },
      { from: EUR, to: USD, rate: r(1.2) },
      { from: USD, to: EUR, rate: r(0.83333) },
    ];
    const provider = new DummyCurrencyProviderService(conversionRates);

    it('convertTo: converting an amount with the same currency returns the same value', () => {
      const amt = Amount.create([{ currency: USD, value: r(50) }]);
      const convertedOpt = amt.convertTo(USD, provider, policy);
      expect(convertedOpt).not.toEqual(None);
      expect((convertedOpt as Rational).eq(r(50))).toBe(true);
    });

    it('convertTo: converting multiple currencies to a target currency', () => {
      const amt = Amount.create([
        { currency: CAD, value: r(100) }, // 100 * 0.8 = 80 USD
        { currency: EUR, value: r(50) },  // 50 * 1.2 = 60 USD
      ]);
      const convertedOpt = amt.convertTo(USD, provider, policy);
      expect(convertedOpt).not.toEqual(None);
      // Expected total = 80 USD + 60 USD = 140 USD
      expect((convertedOpt as Rational).eq(r(140))).toBe(true);
    });

    it('convertTo: should return None if any currency conversion fails', () => {
      // In this case, no conversion rate from EUR to CAD is registered.
      const amt = Amount.create([{ currency: EUR, value: r(50) }]);
      const convertedOpt = amt.convertTo(CAD, provider, policy);
      expect(convertedOpt).toEqual(None);
    });
  });

  describe('isZero', () => {
    const valuationDate = 2000;
    const policy = new ValuationPolicy(valuationDate);
    // Provider with only CAD <-> USD conversions.
    const conversionRates = [
      { from: CAD, to: USD, rate: r(0.8) },
      { from: USD, to: CAD, rate: r(1.25) },
    ];
    const provider = new DummyCurrencyProviderService(conversionRates);

    it('isZero: should return true for an amount with no entries', () => {
      expect(Amount.ZERO.isZero(provider, policy)).toBe(true);
    });

    it('isZero: should return true when all entries are zero', () => {
      const amt = Amount.create([{ currency: USD, value: r(0) }]);
      expect(amt.isZero(provider, policy)).toBe(true);
    });

    it('isZero: should detect a net zero amount with same currency', () => {
      // 10 USD and -10 USD cancel out exactly.
      const amt = Amount.create([
        { currency: USD, value: r(10) },
        { currency: USD, value: r(-10) },
      ]);
      expect(amt.isZero(provider, policy)).toBe(true);
    });

    it('isZero: should use tolerance to consider near-zero amounts as zero', () => {
      // Simulate a rounding error:
      const amt = Amount.create([
        { currency: CAD, value: r(10) },        // 10 CAD -> 8 USD
        { currency: USD, value: r(-8.0001) },   // -10.000125 CAD
      ]);
      // With zero tolerance, this is not zero.
      expect(amt.isZero(provider, policy)).toBe(false);
      // With a tolerance of 0.001, it should be considered zero.
      expect(amt.isZero(provider, policy, r(0.000125))).toBe(true);
      expect(amt.isZero(provider, policy, r(0.0000124))).toBe(false);
    });

    it('isZero: should pick the first nonzero currency as target if none is provided', () => {
      // Create an amount with multiple currencies; the first nonzero entry is used as the target.
      const amt = Amount.create([
        { currency: CAD, value: r(5) },  // This will be used as target if none provided.
        { currency: USD, value: r(-3) },
      ]);
      // Convert to CAD (implicitly) and verify that the conversion works.
      const convertedOpt = amt.convertTo(CAD, provider, policy);
      expect(convertedOpt).not.toEqual(None);
      expect(amt.isZero(provider, policy)).toBe(false);
    });

    it('isZero: should return false if any conversion fails', () => {
      // Use a provider that does not support conversion from EUR to USD.
      const providerFail = new DummyCurrencyProviderService([]);
      expect(Amount.create([
        { currency: EUR, value: r(5) }
      ]).isZero(providerFail, policy)).toBe(false);
      expect(Amount.create([
        { currency: EUR, value: r(5) },
        { currency: USD, value: r(5) },
      ]).isZero(providerFail, policy)).toBe(false);
      expect(Amount.create([
        { currency: EUR, value: r(0) },
        { currency: USD, value: r(5) },
      ]).isZero(providerFail, policy)).toBe(false);
      expect(Amount.create([
        { currency: EUR, value: r(0) },
        { currency: USD, value: r(0) },
      ]).isZero(providerFail, policy)).toBe(true);
    });
  });

  it('toString: coverage', () => {
    expect(Amount.create([{ currency: EUR, value: r(1) }]).toString().length).toBeGreaterThan(0);
  });
});
