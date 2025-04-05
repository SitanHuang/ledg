import { describe, it, expect, beforeEach } from 'vitest';
import { ValueExpressionParser } from './valueExpressionParser.ts';
import { CurrencyProvider } from '../valuation/currencyProvider.ts';
import { AmountParseError, ValueExpressionEvalError } from './parseErrors.ts';
import { Amount } from '../accounting/amount.ts';
import { CurrencyConversionService } from '../valuation/currencyConversionService.ts';
import { ValuationPolicy } from '../valuation/policy.ts';
import { Rational } from '../math/rational.ts';

describe('ValueExpressionParser -> parseAmount part', () => {
  let parser: ValueExpressionParser;
  let currencyProvider: CurrencyProvider;

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider();
  });

  it('parses a single amount with quantity first and currency second', () => {
    const input = '100 BTC-ABC';
    const result = parser.parseAmount(input, currencyProvider);

    const amount = (result as Amount);
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('BTC-ABC');
    expect(entries[0].value.eq(100)).toBe(true);
  });

  it('parses a single amount with currency first and quantity second', () => {
    const input = 'BTC-ABC -100';
    const result = parser.parseAmount(input, currencyProvider);

    const amount = (result as Amount);
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('BTC-ABC');
    expect(entries[0].value.eq(-100)).toBe(true);
  });

  it('parses multiple amounts separated by commas', () => {
    const input = '100 USD, 200 EUR';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(100)).toBe(true);
    expect(entries[1].currency.id).toBe('EUR');
    expect(entries[1].value.eq(200)).toBe(true);
  });

  it('handles extra whitespace gracefully', () => {
    const input = '   150.50   CAD   ,   GBP   -75.25   ';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('CAD');
    expect(entries[0].value.eq(150.50)).toBe(true);
    expect(entries[1].currency.id).toBe('GBP');
    expect(entries[1].value.eq(-75.25)).toBe(true);
  });

  it('parses negative values when quantity comes first', () => {
    const input = '-50 GBP';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.eq(-50)).toBe(true);
  });

  it('parses negative values when currency comes first', () => {
    const input = 'GBP -50';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.eq(-50)).toBe(true);
  });

  it('parses decimal quantities correctly', () => {
    const input = '12.34 USD';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(12.34)).toBe(true);
  });

  it('parses quantities starting with a dot', () => {
    const input = '.75 USD';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(0.75)).toBe(true);
  });

  it('parses an amount with a missing currency code', () => {
    const input = '100';
    const result = parser.parseAmount(input, currencyProvider);

    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe(currencyProvider.defaultCurrencyCode);
    expect(entries[0].value.eq(100)).toBe(true);
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
    expect(entries[0].value.eq(150)).toBe(true);
  });

  it('parses amount with no space between quantity and currency', () => {
    const input = '200GBP';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('GBP');
    expect(entries[0].value.eq(200)).toBe(true);
  });

  it('ignores empty parts when extra commas are present', () => {
    const input = '100 USD, , 200 EUR, ';
    const result = parser.parseAmount(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(100)).toBe(true);
    expect(entries[1].currency.id).toBe('EUR');
    expect(entries[1].value.eq(200)).toBe(true);
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
    expect(entries[0].value.eq(100)).toBe(true);
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
    expect(entries[0].value.eq(100)).toBe(true);
    expect(entries[1].currency.id).toBe('EUR');
    expect(entries[1].value.eq(200)).toBe(true);
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
    expect(entries[0].value.eq(100)).toBe(true);
  });
});

describe('ValueExpressionParser -> evaluateValueExpression part', () => {
  let parser: ValueExpressionParser;
  let currencyProvider: CurrencyProvider;

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider();
  });

  it('evaluates a single bracketed amount literal', () => {
    const input = '[1 USD]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(1)).toBe(true);
  });

  it('evaluates simple addition of same currency amounts', () => {
    const input = '([1 USD] + [2 USD])';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    // Assuming that Amount.plus consolidates entries of the same currency
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(3)).toBe(true);
  });

  it('evaluates subtraction of same currency amounts', () => {
    const input = '([5 USD] - [2 USD])';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(3)).toBe(true);
  });

  it('evaluates multiplication with a scalar', () => {
    const input = '([5 USD] * 3)';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(15)).toBe(true);
  });

  it('evaluates division with a scalar', () => {
    const input = '([10 USD] / 2)';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(5)).toBe(true);
  });

  it('evaluates a complex arithmetic expression', () => {
    // Expression: ([6 USD] / 2 - [1 USD]) equals [2 USD]
    const input = '([6 USD] / 2 - [1 USD])';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(2)).toBe(true);
  });

  it('evaluates nested parentheses expression', () => {
    // Expression: ([1 USD] + ([2 USD] * 3)) equals [7 USD]
    const input = '([1 USD] + ([2 USD] * 3))';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(7)).toBe(true);
  });

  it('delegates a pure amount literal to parseAmount', () => {
    // Input without arithmetic operators should delegate directly to parseAmount.
    const input = 'BTC-ABC -100';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('BTC-ABC');
    expect(entries[0].value.eq(-100)).toBe(true);
  });

  it('handles extra whitespace and formatting variations', () => {
    const input = ' ( [ 3   USD ] *   2 ) ';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(6)).toBe(true);
  });

  it('evaluates multiplication with a negative scalar', () => {
    const input = '([10 USD] * -2)';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(-20)).toBe(true);
  });

  it('evaluates division with a negative scalar', () => {
    const input = '([10 USD] / -2)';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(-5)).toBe(true);
  });

  it('evaluates an expression with decimals', () => {
    const input = '+([2.5 USD] * 2)';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    // 2.5 * 2 = 5, accounting for decimal precision
    expect(entries[0].value.eq(5)).toBe(true);
  });

  it('evaluates addition with multiple currencies separately', () => {
    const input = '([1 USD] + [1 EUR])';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    // Different currencies should remain separate
    expect(entries.length).toBe(2);
    const currencyIds = entries.map(e => e.currency.id).sort();
    expect(currencyIds).toEqual(['EUR', 'USD']);
    entries.forEach(entry => {
      expect(entry.value.eq(1)).toBe(true);
    });
  });

  it('returns error for unsupported function calls', () => {
    const input = 'someDummyFunctionName_23([$1], [EUR 3], "2024-03-01")';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
    expect((result as Error).message).toMatch(/unsupported/i);
  });

  it('returns error for division by zero', () => {
    const input = '([10 USD] / 0)';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    // Depending on the implementation, division by zero should be caught and return an error.
    expect(result).toBeInstanceOf(AmountParseError);
    expect((result as Error).message).toMatch(/zero/i);
  });

  it('evaluates a complex nested expression with mixed operations', () => {
    // Expression: (([10 USD] - [3 USD]) / 7) * 2
    // Calculation: (7 USD / 7) * 2 = [1 USD] * 2 = [2 USD]
    const input = '(( [10 USD] - [3 USD] ) / 7) * 2';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(2)).toBe(true);
  });

  it('should evaluate scalar-only expression', () => {
    const input = '(3 + 5 * 2 + 7) / 3';
    const result = parser.evaluateValueExpression(input, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries[0].currency.id).toBe(currencyProvider.defaultCurrencyCode);
    expect(entries[0].value.eq(new Rational(20n, 3n))).toBe(true);
  });

  it('evaluates unary minus on an amount', () => {
    const input = '-[5 USD]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    expect(entries[0].currency.id).toBe('USD');
    expect(entries[0].value.eq(-5)).toBe(true);
  });

  it('returns error when adding scalar to amount', () => {
    const input = '[5 USD] + 3';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
    expect((result as Error).message.length).toBeGreaterThan(0)
  });

  it('returns error when multiplying two amounts', () => {
    const input = '[5 USD] * [3 EUR]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
    expect((result as Error).message.length).toBeGreaterThan(0)
  });

  it('evaluates mixed currency addition and subtraction', () => {
    const input = '[5 USD] + [3 EUR] - [1 USD]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(Amount);
    const amount = result as Amount;
    const entries = amount.getEntries();
    const usdEntry = entries.find(e => e.currency.id === 'USD');
    const eurEntry = entries.find(e => e.currency.id === 'EUR');
    expect(usdEntry?.value.eq(4)).toBe(true);
    expect(eurEntry?.value.eq(3)).toBe(true);
  });

  it('evaluates operator precedence in amounts', () => {
    const input = '[2 USD] + [3 USD] * 4';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(14)).toBe(true);
  });

  it('returns error for unmatched parentheses', () => {
    const input = '([5 USD] + [3 EUR]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
    expect((result as Error).message.length).toBeGreaterThan(0)
  });

  it('returns error for invalid scalar format', () => {
    const input = '[5 USD] * 2.3.4';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('evaluates unary plus on an amount', () => {
    const input = '+[5 USD]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(5)).toBe(true);
  });

  it('evaluates multiple unary operators', () => {
    const input = '--[5 USD]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(5)).toBe(true);
  });

  it('returns error for invalid currency code', () => {
    const input = '[5 US@D]';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(AmountParseError);
  });

  it('returns error for invalid operator', () => {
    const input = '[5 USD] ^ 2';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('evaluates high precision decimal scalar', () => {
    const input = '[10 USD] / 3';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(new Rational(10n, 3n))).toBe(true);
  });

  it('evaluates scalar expression with negatives', () => {
    const input = '-5 * 3 + 2';
    const result = parser.evaluateValueExpression(input, currencyProvider) as Amount;
    expect(result.getEntries()[0].value.eq(-13)).toBe(true);
  });

  it('evaluates pure amount with multiple currencies', () => {
    const input = '5 USD, 3 EUR';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].value.eq(5)).toBe(true);
    expect(entries[1].value.eq(3)).toBe(true);
  });

  it('handles scalar with negative sign', () => {
    const input = '[5 USD] * -3';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(-15)).toBe(true);
  });

  it('evaluates division by decimal scalar', () => {
    const input = '[10 USD] / 0.5';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(20)).toBe(true);
  });

  it('evaluates deeply nested parentheses', () => {
    const input = '((([2 USD] + [3 USD]) * 2) / (5 - 1))';
    const result = parser.evaluateValueExpression(input, currencyProvider);
    const entries = (result as Amount).getEntries();
    expect(entries[0].value.eq(new Rational(5n, 2n))).toBe(true);
  });
});