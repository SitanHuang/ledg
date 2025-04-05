import { describe, it, expect, beforeEach } from 'vitest';
import { ValueExpressionParser } from './valueExpressionParser.ts';
import { CurrencyProvider } from '../valuation/currencyProvider.ts';
import { AmountParseError } from './parseErrors.ts';
import { Amount } from '../accounting/amount.ts';
import { CurrencyConversionService } from '../valuation/currencyConversionService.ts';
import { ValuationPolicy } from '../valuation/policy.ts';

describe('ValueExpressionParser', () => {
  let parser: ValueExpressionParser;
  let currencyProvider: CurrencyProvider;

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider();
  });

  it('parses a single amount with quantity first and currency second', () => {
    const input = '100 USD';
    const result = parser.parseAmount(input, currencyProvider);

    const amount = (result as Amount);
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
  });

  it('parses a single amount with currency first and quantity second', () => {
    const input = 'USD 100';
    const result = parser.parseAmount(input, currencyProvider);

    const amount = (result as Amount);
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
  });

  it('parses multiple amounts separated by commas', () => {
    const input = '100 USD, 200 EUR';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
    expect(entries[1].currency.id).toBe('EUR');
    expect(entries[1].value.toNumber()).toBeCloseTo(200);
  });

  it('handles extra whitespace gracefully', () => {
    const input = '   150.50   CAD   ,   GBP   -75.25   ';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('CAD');
    expect(entries[0].value.toNumber()).toBeCloseTo(150.50);
    expect(entries[1].currency.id).toBe('GBP');
    expect(entries[1].value.toNumber()).toBeCloseTo(-75.25);
  });

  it('parses negative values when quantity comes first', () => {
    const input = '-50 GBP';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.toNumber()).toBeCloseTo(-50);
  });

  it('parses negative values when currency comes first', () => {
    const input = 'GBP -50';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.toNumber()).toBeCloseTo(-50);
  });

  it('parses decimal quantities correctly', () => {
    const input = '12.34 USD';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(12.34);
  });

  it('parses quantities starting with a dot', () => {
    const input = '.75 USD';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(0.75);
  });

  it('parses an amount with a missing currency code', () => {
    const input = '100';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe(currencyProvider.defaultCurrencyCode);
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
  });

  it('returns an error for an empty input string', () => {
    const input = '';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('returns an error for an input with only whitespace', () => {
    const input = '    ';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('returns an error for ambiguous or invalid ordering', () => {
    // Input with ambiguous token ordering should be rejected.
    const input = 'USD100USD';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('returns an error when currency code contains invalid characters', () => {
    // Currency codes must not contain comma, period, forward slash, or at-sign.
    const input = '100 US,D';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('parses an amount with an explicit positive sign', () => {
    const input = '+150 JPY';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('JPY');
    expect(entries[0].value.toNumber()).toBeCloseTo(150);
  });

  it('parses amount with no space between quantity and currency', () => {
    const input = '200GBP';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.toNumber()).toBeCloseTo(200);
  });

  it('ignores empty parts when extra commas are present', () => {
    const input = '100 USD, , 200 EUR, ';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
    expect(entries[1].currency.id).toBe('EUR');
    expect(entries[1].value.toNumber()).toBeCloseTo(200);
  });

  it('returns an error if one of the parts is missing quantity', () => {
    const input = '100 USD, ABC';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('parses zero amounts correctly', () => {
    const input = '0 EUR, 0.0 USD';
    const result = parser.parseAmount(input, currencyProvider) as Amount;
    expect(result.isZero(new CurrencyConversionService(), new ValuationPolicy(0))).toBe(true);
  });

  it('parses quantity with a trailing dot correctly', () => {
    const input = '100. USD';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
  });

  it('returns an error for ambiguous extra currency tokens', () => {
    // E.g., multiple currency identifiers after a valid quantity should be rejected.
    const input = '100 USD USD';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('returns an error for an invalid numeric format with extra sign', () => {
    const input = '++100 USD';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('returns an error when currency contains a forward slash', () => {
    const input = '100 US/D';
    const result = parser.parseAmount(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('parses mixed ordering in a single expression', () => {
    // First amount is currency-first and second is quantity-first.
    const input = 'USD 100,200 EUR';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
    expect(entries[1].currency.id).toBe('EUR');
    expect(entries[1].value.toNumber()).toBeCloseTo(200);
  });

  it('returns an error for input with only an invalid currency token', () => {
    // "!!!" is treated as a currency token but missing quantity.
    expect(parser.parseAmount('!!!', currencyProvider)).toBeInstanceOf(AmountParseError);
    // invalid currency character but is not taken as a quantity
    expect(parser.parseAmount(',', currencyProvider)).toBeInstanceOf(AmountParseError);
    // invalid currency character but goes to quantity branch
    expect(parser.parseAmount('@', currencyProvider)).toBeInstanceOf(AmountParseError);
  });
  it('returns an error for input with brackets', () => {
    expect(parser.parseAmount('[]', currencyProvider)).toBeInstanceOf(AmountParseError);
    expect(parser.parseAmount('[', currencyProvider)).toBeInstanceOf(AmountParseError);
    expect(parser.parseAmount(']', currencyProvider)).toBeInstanceOf(AmountParseError);
  });

  it('parses an amount with currency first where quantity has an explicit plus sign attached', () => {
    const input = 'GBP+100';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.toNumber()).toBeCloseTo(100);
  });
});
