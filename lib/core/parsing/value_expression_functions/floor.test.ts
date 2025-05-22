import { beforeEach, describe, expect, it } from 'vitest';
import { Amount } from '../../accounting/amount.ts';
import { ValuationConfiguration } from '../../config/valuationConfigs.ts';
import { Rational } from '../../math/rational.ts';
import { CurrencyProvider } from '../../valuation/currencyProvider.ts';
import { ValueExpressionEvalError } from '../parseErrors.ts';
import { ValueExpressionParser } from '../valueExpressionParser.ts';

describe('ValueExpressionParser -> floor()', () => {
  let parser: ValueExpressionParser;
  let currencyProvider: CurrencyProvider;

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider(new ValuationConfiguration());
  });

  const r = (num: number) => Rational.fromNumber(num);

  beforeEach(() => {
    parser = new ValueExpressionParser();
    currencyProvider = new CurrencyProvider(new ValuationConfiguration());
  });

  it('should correctly floor a positive amount to specified precision', () => {
    const expr = "floor([1.2395 USD], 2)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    expect(entries[0].value.eq(r(1.23))).toBe(true);
  });

  it('should correctly floor a negative amount to specified precision', () => {
    const expr = "floor([-2.718 CAD], 1)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("CAD");
    expect(entries[0].value.eq(r(-2.8))).toBe(true);
  });

  it('should omit currency entries that floor to zero', () => {
    const expr = "floor([0.0079 EUR], 2)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(0);
  });

  it('should correctly floor multiple currency entries independently', () => {
    const expr = "floor([1.999 USD, -3.14159 CAD], 1)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(2);

    const usdEntry = entries.find(e => e.currency.id === "USD");
    const cadEntry = entries.find(e => e.currency.id === "CAD");
    expect(usdEntry).toBeDefined();
    expect(cadEntry).toBeDefined();
    expect(usdEntry!.value.eq(r(1.9))).toBe(true);
    expect(cadEntry!.value.eq(r(-3.2))).toBe(true);
  });

  it('should handle flooring when precision is zero (default dp)', () => {
    // Without a second argument, the dp defaults to 0.
    const expr = "floor([1.5 USD, -2.5 CAD])";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(2);

    const usdEntry = entries.find(e => e.currency.id === "USD");
    const cadEntry = entries.find(e => e.currency.id === "CAD");
    expect(usdEntry).toBeDefined();
    expect(cadEntry).toBeDefined();
    expect(usdEntry!.value.eq(r(1))).toBe(true);
    expect(cadEntry!.value.eq(r(-3))).toBe(true);
  });

  it('should floor a scalar and return an Amount with default currency', () => {
    // When a scalar is returned from the expression, it gets cast to an Amount with the default currency
    let expr = "3 * -(-floor(-1.45, 1) * -1 / 3)";
    let result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    let entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe(currencyProvider.valuationConfig.defaultCurrencyCode);
    expect(entries[0].value.eq(r(3 * -(-Math.floor(-1.45 * 10) / 10 * -1 / 3)))).toBe(true);
    expr = "3 * -(-floor(1.45, 1) * -1 / 3)";
    result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe(currencyProvider.valuationConfig.defaultCurrencyCode);
    expect(entries[0].value.eq(r(3 * -(-Math.floor(1.45 * 10) / 10 * -1 / 3)))).toBe(true);
  });

  it('should apply unary minus to the floor result', () => {
    // The test case provided in the starter code comment.
    const expr = "-floor([23 USD])";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    expect(entries[0].value.eq(r(-23))).toBe(true);
  });

  it('should error when floor receives a non-integer second argument', () => {
    expect(parser.evaluateValueExpression("floor(1.23, 1.5)", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("floor(1.23, 1.5, \"\")", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("floor(1.23, \"\")", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("floor(1.23, [0USD])", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when floor receives no arguments', () => {
    const expr = "floor()";
    const result = parser.evaluateValueExpression(expr, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when floor receives too many arguments', () => {
    const expr = "floor(1, 2, 3)";
    const result = parser.evaluateValueExpression(expr, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
    expect((result as Amount).sourceString).toBe(expr);
  });

  it('should error when floor\'s first argument is a string literal', () => {
    expect(parser.evaluateValueExpression(`floor('invalid', 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression(`floor("invalid", 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression(`floor(, 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
  });

});