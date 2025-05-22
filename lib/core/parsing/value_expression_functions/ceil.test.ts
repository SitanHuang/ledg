import { beforeEach, describe, expect, it } from 'vitest';
import { Amount } from '../../accounting/amount.ts';
import { ValuationConfiguration } from '../../config/valuationConfigs.ts';
import { Rational } from '../../math/rational.ts';
import { CurrencyProvider } from '../../valuation/currencyProvider.ts';
import { ValueExpressionEvalError } from '../parseErrors.ts';
import { ValueExpressionParser } from '../valueExpressionParser.ts';

describe('ValueExpressionParser -> ceil()', () => {
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

  it('should correctly ceil a positive amount to specified precision', () => {
    const expr = "ceil([1.2345 USD], 2)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    expect(entries[0].value.eq(r(1.24))).toBe(true);
  });

  it('should correctly ceil a negative amount to specified precision', () => {
    const expr = "ceil([-2.718 CAD], 1)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("CAD");
    expect(entries[0].value.eq(r(-2.7))).toBe(true);
  });

  it('should omit currency entries that ceil to zero', () => {
    const expr = "ceil([-0.0049 EUR], 2)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(0);
  });

  it('should correctly ceil multiple currency entries independently', () => {
    const expr = "ceil([1.999 USD, -3.14159 CAD], 1)";
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

  it('should handle ceiling when precision is zero (default dp)', () => {
    // Without a second argument, the dp defaults to 0.
    const expr = "ceil([1.5 USD, -2.5 CAD])";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(2);

    const usdEntry = entries.find(e => e.currency.id === "USD");
    const cadEntry = entries.find(e => e.currency.id === "CAD");
    expect(usdEntry).toBeDefined();
    expect(cadEntry).toBeDefined();
    expect(usdEntry!.value.eq(r(2))).toBe(true);
    expect(cadEntry!.value.eq(r(-2))).toBe(true);
  });

  it('should ceil a scalar and return an Amount with default currency', () => {
    // When a scalar is returned from the expression, it gets cast to an Amount with the default currency
    const expr = "3 * -(-ceil(-1.45, 1) * -1 / 3)";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe(currencyProvider.valuationConfig.defaultCurrencyCode);
    expect(entries[0].value.eq(r(3 * -(-Math.ceil(-1.45 * 10) / 10 * -1 / 3)))).toBe(true);
  });

  it('should apply unary minus to the ceil result', () => {
    // The test case provided in the starter code comment.
    const expr = "-ceil([23 USD])";
    const result = parser.evaluateValueExpression(expr, currencyProvider) as Amount;
    const entries = result.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].currency.id).toBe("USD");
    expect(entries[0].value.eq(r(-23))).toBe(true);
  });

  it('should error when ceil receives a non-integer second argument', () => {
    expect(parser.evaluateValueExpression("ceil(1.23, 1.5)", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("ceil(1.23, 1.5, \"\")", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("ceil(1.23, \"\")", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression("ceil(1.23, [0USD])", currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when ceil receives no arguments', () => {
    const expr = "ceil()";
    const result = parser.evaluateValueExpression(expr, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
  });

  it('should error when ceil receives too many arguments', () => {
    const expr = "ceil(1, 2, 3)";
    const result = parser.evaluateValueExpression(expr, currencyProvider);
    expect(result).toBeInstanceOf(ValueExpressionEvalError);
    expect((result as Amount).sourceString).toBe(expr);
  });

  it('should error when ceil\'s first argument is a string literal', () => {
    expect(parser.evaluateValueExpression(`ceil('invalid', 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression(`ceil("invalid", 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
    expect(parser.evaluateValueExpression(`ceil(, 1)`, currencyProvider)).toBeInstanceOf(ValueExpressionEvalError);
  });

});