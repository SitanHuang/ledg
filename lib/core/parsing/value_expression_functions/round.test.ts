import { describe, it, expect, beforeEach } from 'vitest';
import { ValueExpressionParser } from '../valueExpressionParser.ts';
import { CurrencyProvider } from '../../valuation/currencyProvider.ts';
import { AmountParseError, ValueExpressionEvalError } from '../parseErrors.ts';
import { Amount } from '../../accounting/amount.ts';
import { Rational } from '../../math/rational.ts';
import { unwrap } from '../../types.ts';

describe('ValueExpressionParser -> round()', () => {
  let parser: ValueExpressionParser;
  let currencyProvider: CurrencyProvider;

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider();
  });

  const r = (num: number) => Rational.fromNumber(num);

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider();
  });

  it('should correctly round a positive amount to specified precision', () => {
    const expr = "round([1.2345 USD], 2)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    expect(entries[0].value.eq(r(1.23))).toBe(true);
  });

  it('should correctly round a negative amount to specified precision', () => {
    const expr = "round([-2.718 CAD], 1)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("CAD");
    expect(entries[0].value.eq(r(-2.7))).toBe(true);
  });

  it('should omit currency entries that round to zero', () => {
    const expr = "round([0.0049 EUR], 2)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(0);
    expect(result).toEqual(Amount.ZERO);
  });

  it('should correctly round multiple currency entries independently', () => {
    const expr = "round([1.999 USD, -3.14159 CAD], 1)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(2);

    const usdEntry = entries.find(e => e.currency.id === "USD");
    const cadEntry = entries.find(e => e.currency.id === "CAD");
    expect(usdEntry).toBeDefined();
    expect(cadEntry).toBeDefined();
    expect(usdEntry!.value.eq(r(2.0))).toBe(true);
    expect(cadEntry!.value.eq(r(-3.1))).toBe(true);
  });

  it('should handle rounding when precision is zero (default dp)', () => {
    // Without a second argument, the dp defaults to 0.
    const expr = "round([1.5 USD, -2.5 CAD])";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(2);

    const usdEntry = entries.find(e => e.currency.id === "USD");
    const cadEntry = entries.find(e => e.currency.id === "CAD");
    expect(usdEntry).toBeDefined();
    expect(cadEntry).toBeDefined();
    expect(usdEntry!.value.eq(r(2))).toBe(true);
    expect(cadEntry!.value.eq(r(-3))).toBe(true);
  });

  it('should round a scalar and return an Amount with default currency', () => {
    // When a scalar is returned from the expression, it gets cast to an Amount with the default currency
    const expr = "3 * -(-round(-1.45, 1) * -1 / 3)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe(currencyProvider.defaultCurrencyCode);
    expect(entries[0].value.eq(r(1.5))).toBe(true);
  });

  it('should apply unary minus to the round result', () => {
    // The test case provided in the starter code comment.
    const expr = "-round([23 USD])";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    expect(entries[0].value.eq(r(-23))).toBe(true);
  });

  it('should error when round receives a non-integer second argument', () => {
    expect(parser.evaluateValueExpression("round(1.23, 1.5)", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("round(1.23, 1.5, \"\")", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("round(1.23, \"\")", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("round(1.23, [0USD])", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when round receives no arguments', () => {
    const expr = "round()";
    const result = parser.evaluateValueExpression(expr, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when round receives too many arguments', () => {
    const expr = "round(1, 2, 3)";
    const result = parser.evaluateValueExpression(expr, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when round\'s first argument is a string literal', () => {
    expect(parser.evaluateValueExpression(`round('invalid', 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression(`round("invalid", 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression(`round(, 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
  });

});