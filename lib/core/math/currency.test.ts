import { describe, it, expect, beforeEach } from 'vitest';
import { Currency } from './currency.ts';
import { Rational } from './rational.ts';
import { None, unwrap } from '../types.ts';
import { CurrencyProviderService } from '../valuation/currencyProviderService.ts';

describe('CurrencyProviderService', () => {
  let service: CurrencyProviderService;
  let currencyA: Currency;
  let currencyB: Currency;
  let currencyC: Currency;
  let currencyD: Currency;

  beforeEach(() => {
    service = new CurrencyProviderService();
    currencyA = new Currency('A', '$');
    currencyB = new Currency('B', '€');
    currencyC = new Currency('C', '£');
    currencyD = new Currency('D', '¥');
  });

  it('should return identity conversion for the same currency', () => {
    const now = Date.now();
    const rate = service.resolveConversion(currencyA, currencyA, now);
    expect(unwrap(rate).eq(Rational.ONE)).toBe(true);
  });

  it('should register a direct conversion and its reciprocal', () => {
    const timestamp = 1000;
    // For example, conversion A -> B at 3/2 implies B -> A should be 2/3.
    const rateAtoB = new Rational(3n, 2n);
    service.registerConversion(currencyA, currencyB, rateAtoB, timestamp);

    const resolvedAtoB = service.resolveConversion(currencyA, currencyB, timestamp);
    expect(unwrap(resolvedAtoB).eq(rateAtoB)).toBe(true);

    const resolvedBtoA = service.resolveConversion(currencyB, currencyA, timestamp);
    const reciprocalRate = new Rational(2n, 3n);
    expect(unwrap(resolvedBtoA).eq(reciprocalRate)).toBe(true);
  });

  it('should resolve conversion using multi-step path when direct conversion is not valid at query time', () => {
    // Setup scenario:
    // A -> B at t=1000 with rate 2/1,
    // B -> C at t=1000 with rate 3/1,
    // A -> C at t=2000 with rate 10/1 (direct, but not available at t < 2000).
    const t1 = 1000;
    const t2 = 2000;
    const rateAtoB = new Rational(2n, 1n);
    const rateBtoC = new Rational(3n, 1n);
    const rateAtoC = new Rational(10n, 1n);

    service.registerConversion(currencyA, currencyB, rateAtoB, t1);
    service.registerConversion(currencyB, currencyC, rateBtoC, t1);
    service.registerConversion(currencyA, currencyC, rateAtoC, t2);

    // At timestamp 1500, direct A->C is not valid; expected path is A->B->C:
    // Composite rate should be 2 * 3 = 6.
    const resolvedAtoC = service.resolveConversion(currencyA, currencyC, 1500);
    const expectedComposite = new Rational(6n, 1n);
    expect(unwrap(resolvedAtoC).eq(expectedComposite)).toBe(true);

    // Also check reverse: C->A should be reciprocal of 6 i.e. 1/6.
    const resolvedCtoA = service.resolveConversion(currencyC, currencyA, 1500);
    const expectedReverse = new Rational(1n, 6n);
    expect(unwrap(resolvedCtoA).eq(expectedReverse)).toBe(true);
  });

  it('should resolve direct conversion when available', () => {
    const timestamp = 3000;
    const rateAtoB = new Rational(5n, 2n);
    service.registerConversion(currencyA, currencyB, rateAtoB, timestamp);
    const resolvedRate = service.resolveConversion(currencyA, currencyB, timestamp);
    expect(unwrap(resolvedRate).eq(rateAtoB)).toBe(true);
  });

  it('should correctly handle zero conversion rates', () => {
    const timestamp = 4000;
    // Zero conversion rate should result in both directions being zero.
    service.registerConversion(currencyA, currencyB, Rational.ZERO, timestamp);

    const resolvedAtoB = service.resolveConversion(currencyA, currencyB, timestamp);
    expect(unwrap(resolvedAtoB).eq(Rational.ZERO)).toBe(true);

    const resolvedBtoA = service.resolveConversion(currencyB, currencyA, timestamp);
    expect(unwrap(resolvedBtoA).eq(Rational.ZERO)).toBe(true);
  });

  it('should to return None when no conversion path is available', () => {
    const timestamp = 5000;
    // No conversion exists between A and D.
    expect(service.resolveConversion(currencyA, currencyD, timestamp)).toEqual(None);
  });

  it('should choose the shortest (fewest-hop) valid path when multiple paths exist', () => {
    // Setup:
    // Path 1: A -> B at t=6000 (rate=2) then B -> D at t=6000 (rate=3) => composite = 6.
    // Path 2: A -> C at t=6000 (rate=4) then C -> D at t=6000 (rate=2) => composite = 8.
    // Also register a direct conversion A -> D at t=7000 (rate=10) which is not valid at t=6000.
    const t = 6000;
    const tDirect = 7000;
    service.registerConversion(currencyA, currencyB, new Rational(2n, 1n), t);
    service.registerConversion(currencyB, currencyD, new Rational(3n, 1n), t);
    service.registerConversion(currencyA, currencyC, new Rational(4n, 1n), t);
    service.registerConversion(currencyC, currencyD, new Rational(2n, 1n), t);
    service.registerConversion(currencyA, currencyD, new Rational(10n, 1n), tDirect);

    const resolvedRate = service.resolveConversion(currencyA, currencyD, t);
    // Both paths have 2 hops. BFS will return the first valid path encountered.
    // Accept either composite rate 6 or 8.
    const isValid = unwrap(resolvedRate).eq(new Rational(6n, 1n)) || unwrap(resolvedRate).eq(new Rational(8n, 1n));
    expect(isValid).toBe(true);
  });

  it('should correctly handle out-of-order registration of conversion rates', () => {
    // Register two conversions for A -> B in reverse order.
    service.registerConversion(currencyA, currencyB, new Rational(3n, 1n), 2000);
    service.registerConversion(currencyA, currencyB, new Rational(2n, 1n), 1000);
    // Query at t=1500 should select the registration at t=1000 (rate 2) since 2000 > 1500.
    const resolvedRate = service.resolveConversion(currencyA, currencyB, 1500);
    expect(unwrap(resolvedRate).eq(new Rational(2n, 1n))).toBe(true);
  });

  describe('Additional Edge Coverage Tests', () => {
    let service: CurrencyProviderService;
    let currencyA: Currency;
    let currencyB: Currency;

    beforeEach(() => {
      service = new CurrencyProviderService();
      currencyA = new Currency('A', '$');
      currencyB = new Currency('B', '€');
    });

    it('should create a new edge map if none exists (covering branch in insertEdgeRegistration)', () => {
      const timestamp = 1000;
      const rate = new Rational(3n, 2n);
      // Pre-register currencyA so it has an edge map...
      service.registerCurrency(currencyA);
      // ...then force removal of its edge map to simulate the branch where fromMap is undefined.
      (service as any)['edges'].delete(currencyA.id);

      // Register conversion which should internally create a new edge map for currencyA.
      service.registerConversion(currencyA, currencyB, rate, timestamp);

      // Assert that a new edge map has been created and contains an entry for currencyB.
      const fromMap = (service as any)['edges'].get(currencyA.id);
      expect(fromMap).toBeDefined();
      expect(fromMap.has(currencyB.id)).toBe(true);
    });

    it('should correctly insert a registration in the middle using binary search (covering if(arr[mid].timestamp < timestamp))', () => {
      // Register three conversions for A->B with out-of-order timestamps.
      // First, register at t=3000.
      service.registerConversion(currencyA, currencyB, new Rational(3n, 1n), 3000);
      // Then, register at t=1000 (should be inserted before the t=3000 entry).
      service.registerConversion(currencyA, currencyB, new Rational(1n, 1n), 1000);
      // Finally, register at t=2000 (this should be inserted between the previous two).
      service.registerConversion(currencyA, currencyB, new Rational(2n, 1n), 2000);

      // When querying at t=2500, the latest valid registration should be the one at t=2000 (rate 2/1).
      const resolvedRate = service.resolveConversion(currencyA, currencyB, 2500);
      expect(unwrap(resolvedRate).eq(new Rational(2n, 1n))).toBe(true);
    });
  });
});
