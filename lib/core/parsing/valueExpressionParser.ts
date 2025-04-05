
import { Amount } from "../accounting/amount.ts";
import { Result } from "../types.ts";
import { Currency } from "../valuation/currency.ts";
import { Rational } from "../math/rational.ts";
import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { AmountParseError } from "./parseErrors.ts";

export class ValueExpressionParser {
  private static readonly QUANTITY_PATTERN = '[+-]?(\\d+\\.?\\d*|\\.\\d+)';
  private static readonly CURRENCY_PATTERN = '[^\\d\\s,*.\\/@]+';

  private static readonly QUANTITY_REGEX = new RegExp(`^${ValueExpressionParser.QUANTITY_PATTERN}`);
  private static readonly CURRENCY_REGEX = new RegExp(`^${ValueExpressionParser.CURRENCY_PATTERN}`);
  private static readonly QUANTITY_REGEX_FULL = new RegExp(`^${ValueExpressionParser.QUANTITY_PATTERN}$`);
  private static readonly CURRENCY_REGEX_FULL = new RegExp(`^${ValueExpressionParser.CURRENCY_PATTERN}$`);

  /**
   * Parse a pure amount string (the part inside "[]" in a value expression).
   * Each amount is either in the form "<quantity><whitespace><currency>" or
   * vice versa, and multiple amounts are comma separated. Currency code can be
   * an empty string; in that case, the CurrencyProvider determines
   * implementation-specific behavior.
   *
   * A <quantity> may begin with optional "+" or "-" sign followed by a 10-base
   * decimal. Leading zero before the decimal point is optional.
   *
   * A <currency> is any non-numeric string any non-numeric string that does not
   * contain a period, comma, forward slash or at-sign. It may appear after or
   * before a <quantity>.
   *
   * @param input - The pure amount string.
   * @param currencyProvider - A provider to resolve currencies.
   * @returns A Result containing the parsed Amount or an Error.
   */
  parseAmount(input: string, currencyProvider: CurrencyProvider): Result<Amount, AmountParseError> {
    if (input.includes("[")) {
      return new AmountParseError("Unreachable.", input);
    }

    /* Benchmark results:
        this implementation: 6.713s
        split + regex branching only: 7.983s
        purely hand coded: 7.123s
    */

    const parts = input.split(',');
    const entries: { currency: Currency, value: Rational }[] = [];

    for (let part of parts) {
      part = part.trim();

      if (!part)
        continue;

      let quantityStr: string;
      let currencyStr: string;
      const firstChar = part[0];

      if (firstChar === '+' || firstChar === '-' || firstChar === '.' || (firstChar >= '0' && firstChar <= '9')) {
        const quantityMatch = part.match(ValueExpressionParser.QUANTITY_REGEX);

        if (!quantityMatch) {
          return new AmountParseError(`Invalid amount format, expected quantity first in "${part}"`, input);
        }

        quantityStr = quantityMatch[0];
        currencyStr = part.slice(quantityStr.length).trim();

        if (currencyStr && !currencyStr.match(ValueExpressionParser.CURRENCY_REGEX_FULL)) {
          return new AmountParseError(`Invalid amount format, improper currency format in "${part}"`, input);
        }
      } else {
        const currencyMatch = part.match(ValueExpressionParser.CURRENCY_REGEX);

        if (!currencyMatch) {
          return new AmountParseError(`Invalid amount format, expected currency first in "${part}"`, input);
        }

        currencyStr = currencyMatch[0];

        const rest = part.slice(currencyStr.length).trim();
        if (!rest) {
          return new AmountParseError(`Missing quantity after currency in "${part}"`, input);
        }

        if (currencyStr.endsWith("+")) {
          // a "+" sign at the end of <currency> should stick with the quantity
          currencyStr = currencyStr.substring(0, currencyStr.length - 1);
        }

        const quantityMatch = rest.match(ValueExpressionParser.QUANTITY_REGEX_FULL);
        if (!quantityMatch) {
          return new AmountParseError(`Invalid quantity format in "${part}"`, input);
        }

        quantityStr = quantityMatch[0];
      }

      entries.push({
        currency: currencyProvider.getOrCreateCurrencyById(currencyStr),
        value: Rational.parse(quantityStr) // assume by this point the quantity string has valid syntax
      });
    }

    if (!entries.length) {
      return new AmountParseError("Empty Amount captured.", input);
    }

    return Amount.create(entries);
  }


}