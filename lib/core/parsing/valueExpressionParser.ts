
import { Amount } from "../accounting/amount.ts";
import { Rational } from "../math/rational.ts";
import { Result } from "../types.ts";
import { Currency } from "../valuation/currency.ts";
import { CurrencyProvider } from "../valuation/currencyProvider.ts";
import { AmountParseError, ValueExpressionEvalError } from "./parseErrors.ts";
import { CeilFunction } from "./value_expression_functions/ceil.ts";
import { DebugIdentityFunction } from "./value_expression_functions/debug.ts";
import { FloorFunction } from "./value_expression_functions/floor.ts";
import { RoundFunction } from "./value_expression_functions/round.ts";

export type EvalValue =
  | { type: "scalar"; value: Rational }
  | { type: "amount"; value: Amount }
  | { type: "string"; value: string };

export type BinaryOperator = "+" | "-" | "*" | "/";

export type Token = {
  type: "amount" | "paren" | "comma" | "number" | "identifier" | "operator" | "string",
  value: string;
} | {
  type: "operator",
  value: BinaryOperator
};

export class ValueExpressionParser {
  public static readonly QUANTITY_PATTERN = '[+-]?(\\d+\\.?\\d*|\\.\\d+)';
  public static readonly CURRENCY_PATTERN = '[^\\d\\s,*.\\/@:]+';

  public static readonly QUANTITY_REGEX = new RegExp(`^${ValueExpressionParser.QUANTITY_PATTERN}`);
  public static readonly CURRENCY_REGEX = new RegExp(`^${ValueExpressionParser.CURRENCY_PATTERN}`);
  public static readonly QUANTITY_REGEX_FULL = new RegExp(`^${ValueExpressionParser.QUANTITY_PATTERN}$`);
  public static readonly CURRENCY_REGEX_FULL = new RegExp(`^${ValueExpressionParser.CURRENCY_PATTERN}$`);

  /**
   * Evaluate a value expression string. A value expression string currently supports:
   *   - bracket-enclosed Amount string literal
   *   - Precedence-aware arithmetics: plus, minus, divide, times
   *       ex. "([1 USD] / +3 + [1 CAD]) * (-2 + 0.1)"
   *   - any future-supported function calls (non-supported yet)
   *       ex. "ratio([$1], [EUR 3], "2024-03-01")" -> ValueExpressionEvalError: "ratio(3) is unsupported."
   *
   * An Amount can only be divided or multiplied by a scalar.
   *
   * If the input can be quickly identified as a pure Amount literal (i.e. it
   * does not contain any grouping or arithmetic operators such as '(', ')',
   * '*', '/', '[' or ']'), then this method directly delegates parsing to
   * parseAmount for performance.
   *
   * Note: Ambiguous '+/-' signs are interpreted as part of the numeric
   * quantities. If these signs were intended as arithmetic operators, the
   * parser will emit an error.
   *
   *
   * If the final result is a scalar, it will be cast into an Amount with an
   * empty-string currency.
   *
   * @param input - The value expression string.
   * @param currencyProvider - A provider to resolve currencies.
   * @returns A Result containing the parsed Amount, a AmountParseError (if any
   * bracketed Amount string fails to be parsed), or a ValueExpressionEvalError.
   */
  evaluateValueExpression(
    input: string,
    currencyProvider: CurrencyProvider
  ): Result<Amount, AmountParseError | ValueExpressionEvalError> {
    if (
      !input.includes('(') &&
      !input.includes(')') &&
      !input.includes('*') &&
      !input.includes('/') &&
      !input.includes('[') &&
      !input.includes(']')
    ) {
      return this.parseAmount(input, currencyProvider);
    }

    try {
      const tokens = tokenize(input);
      const parser = new Parser(
        tokens,
        currencyProvider,
        this.parseAmount.bind(this),
        input
      );
      const result = parser.parseExpression();
      if (!parser.atEnd()) {
        return new ValueExpressionEvalError("Unexpected extra tokens", input);
      }
      if (result.type === "string") {
        return new ValueExpressionEvalError("Value expression cannot return a string", input);
      }

      // If the final result is a scalar, convert it to an Amount with the empty-string currency.
      if (result.type === "scalar") {
        const defaultCurrency = currencyProvider.getOrCreateCurrencyById("");
        return Amount.create([{ currency: defaultCurrency, value: result.value }], input);
      }


      const finalAmount: Amount = result.value;
      return Amount.fromAmount(finalAmount, input); // clone the old one and assign input string as source
    } catch (e) {
      if (e instanceof AmountParseError || e instanceof ValueExpressionEvalError) {
        return e;
      }
      return new ValueExpressionEvalError((e as Error).message, input);
    }
  }

  /**
   * Parse a pure Amount string (the part inside "[]" in a value expression).
   * Each Amount is either in the form "<quantity><whitespace><currency>" or
   * vice versa, and multiple Amounts are comma separated. Currency code can be
   * an empty string; in that case, the CurrencyProvider determines
   * implementation-specific behavior.
   *
   * A <quantity> may begin with optional "+" or "-" sign followed by a 10-base
   * decimal. Leading zero before the decimal point is optional.
   *
   * A <currency> is a non-numeric string, and multiple entries may be separated
   * by commas; more formally:
   *
   *   currency-code := "" | non-empty-string
   *     where non-empty-string := 1*<CHAR> where CHAR ∉ { 0–9, whitespace, ',', '*', '.', '/', '@', ':' }
   *
   * Note: Ambiguous '+/-' signs are interpreted as part of the numeric quantities. If these signs were
   * intended as arithmetic operators, the parser will emit an error.
   *
   * @param input - The pure Amount string.
   * @param currencyProvider - A provider to resolve currencies.
   * @returns A Result containing the parsed Amount or an Error.
   */
  parseAmount(input: string, currencyProvider: CurrencyProvider): Result<Amount, AmountParseError> {
    if (input.includes("[")) {
      return new AmountParseError("Amount literal cannot contain brackets.", input);
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

    return Amount.create(entries, input);
  }


}

export function isValidCurrencyCode(input: string): boolean {
  return ValueExpressionParser.CURRENCY_REGEX_FULL.test(input);
}

const WHITESPACE_RGX = /\s/;
const DIGIT_RGX = /[0-9.]/;
const IDENTIFIER_RGX = /[A-Za-z_]/;
const IDENTIFIER2_RGX = /[A-Za-z0-9_]/;

/**
 * Tokenizes the input string into an array of tokens.
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;
  while (i < len) {
    const ch = input[i];
    // Skip whitespace
    if (WHITESPACE_RGX.test(ch)) {
      i++;
      continue;
    }
    // Amount literal: [ ... ]
    if (ch === "[") {
      i++; // skip '['
      let literal = "";
      while (i < len && input[i] !== "]") {
        literal += input[i];
        i++;
      }
      if (i >= len) {
        throw new ValueExpressionEvalError("Unmatched '['", input);
      }
      i++; // skip ']'
      tokens.push({ type: "amount", value: literal.trim() });
      continue;
    }
    // Parentheses
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    // Operators
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "operator", value: ch });
      i++;
      continue;
    }
    // Comma (for function argument separation)
    if (ch === ",") {
      tokens.push({ type: "comma", value: ch });
      i++;
      continue;
    }
    // Number literal (digits and decimal point)
    if (DIGIT_RGX.test(ch)) {
      let numStr = "";
      while (i < len && DIGIT_RGX.test(input[i])) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: "number", value: numStr });
      continue;
    }
    // String literal: support for double and single quotes
    if (ch === '"' || ch === "'") {
      const quoteType = ch;
      i++; // skip opening quote
      let literal = "";
      while (i < len && input[i] !== quoteType) {
        if (input[i] === '\\') {
          i++;
          if (i < len) {
            literal += input[i];
            i++;
          }
        } else {
          literal += input[i];
          i++;
        }
      }
      if (i >= len) {
        throw new ValueExpressionEvalError("Unterminated string literal", input);
      }
      i++; // skip closing quote
      tokens.push({ type: "string", value: literal });
      continue;
    }
    // Identifier (for function names)
    if (IDENTIFIER_RGX.test(ch)) {
      let ident = "";
      while (i < len && IDENTIFIER2_RGX.test(input[i])) {
        ident += input[i];
        i++;
      }
      tokens.push({ type: "identifier", value: ident });
      continue;
    }
    throw new ValueExpressionEvalError(`Unexpected character '${ch}'`, input);
  }
  return tokens;
}

/**
 * Recursive descent parser for value expressions.
 */
class Parser {
  private tokens: Token[];
  private pos = 0;
  private currencyProvider: CurrencyProvider;
  private parseAmountFunc: (input: string, cp: CurrencyProvider) => Result<Amount, AmountParseError>;
  private input: string;

  constructor(
    tokens: Token[],
    currencyProvider: CurrencyProvider,
    parseAmountFunc: (input: string, cp: CurrencyProvider) => Result<Amount, AmountParseError>,
    input: string
  ) {
    this.tokens = tokens;
    this.currencyProvider = currencyProvider;
    this.parseAmountFunc = parseAmountFunc;
    this.input = input;
  }

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private current(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private eat(): Token {
    return this.tokens[this.pos++];
  }

  /**
   * Combines two EvalValues using a binary operator.
   */
  private combineBinary(op: BinaryOperator, left: EvalValue, right: EvalValue): EvalValue {
    if (left.type === "string" || right.type === "string") {
      throw new ValueExpressionEvalError("Binary operators do not support string operations", this.input);
    }
    switch (op) {
      case "+":
        if (left.type === right.type) {
          if (left.type === "scalar") {
            return { type: "scalar", value: left.value.plus(right.value as Rational) };
          } else {
            return { type: "amount", value: left.value.plus(right.value as Amount) };
          }
        }
        throw new ValueExpressionEvalError("Incompatible types for operator +", this.input);
      case "-":
        if (left.type === right.type) {
          if (left.type === "scalar") {
            return { type: "scalar", value: left.value.minus(right.value as Rational) };
          } else {
            return { type: "amount", value: left.value.minus(right.value as Amount) };
          }
        }
        throw new ValueExpressionEvalError("Incompatible types for operator -", this.input);
      case "*":
        if (left.type === "scalar" && right.type === "scalar") {
          return { type: "scalar", value: left.value.times(right.value) };
        } else if (left.type === "amount" && right.type === "scalar") {
          return { type: "amount", value: left.value.times(right.value) };
        } else if (left.type === "scalar" && right.type === "amount") {
          return { type: "amount", value: right.value.times(left.value) };
        }
        throw new ValueExpressionEvalError("Multiplication of two Amounts is not allowed", this.input);
      case "/":
        if (left.type === "scalar" && right.type === "scalar") {
          return { type: "scalar", value: left.value.div(right.value) };
        } else if (left.type === "amount" && right.type === "scalar") {
          return { type: "amount", value: left.value.div(right.value) };
        }
        throw new ValueExpressionEvalError(
          "Division is only allowed as Amount divided by scalar or scalar divided by scalar",
          this.input
        );
      default:
        throw new ValueExpressionEvalError(`Unsupported operator '${op}'`, this.input);
    }
  }

  /**
   * Parses an expression (handles + and -).
   * @param inFunctionArg Whether string literals are allowed (only allowed in function arguments)
   */
  parseExpression(inFunctionArg = false): EvalValue {
    let left = this.parseTerm(inFunctionArg);
    while (
      this.current() &&
      this.current()!.type === "operator" &&
      (this.current()!.value === "+" || this.current()!.value === "-")
    ) {
      const op = this.eat().value as BinaryOperator;
      const right = this.parseTerm(inFunctionArg);
      left = this.combineBinary(op, left, right);
    }
    return left;
  }

  /**
   * Parses a term (handles * and /).
   */
  parseTerm(inFunctionArg: boolean): EvalValue {
    let left = this.parseFactor(inFunctionArg);
    while (
      this.current() &&
      this.current()!.type === "operator" &&
      (this.current()!.value === "*" || this.current()!.value === "/")
    ) {
      const op = this.eat().value as BinaryOperator;
      const right = this.parseFactor(inFunctionArg);
      left = this.combineBinary(op, left, right);
    }
    return left;
  }

  /**
   * Parses a factor (handles unary + and -).
   */
  parseFactor(inFunctionArg: boolean): EvalValue {
    if (
      this.current() &&
      this.current()!.type === "operator" &&
      (this.current()!.value === "+" || this.current()!.value === "-")
    ) {
      const op = this.eat().value;
      const operand = this.parseFactor(inFunctionArg);
      if (op === "-") {
        if (operand.type === "scalar") {
          return { type: "scalar", value: operand.value.times(Rational.NEGATIVE_ONE) };
        } else if (operand.type === "string") {
          throw new ValueExpressionEvalError("Binary operators do not support string operations", this.input);
        } else {
          return { type: "amount", value: operand.value.times(Rational.NEGATIVE_ONE) };
        }
      }
      return operand; // unary plus
    }
    return this.parsePrimary(inFunctionArg);
  }

  /**
   * Parses a primary value: number, amount literal, parenthesized expression, function call, or string literal.
   */
  parsePrimary(inFunctionArg: boolean): EvalValue {
    const token = this.current();
    if (!token) {
      throw new ValueExpressionEvalError("Unexpected end of expression", this.input);
    }
    if (token.type === "number") {
      this.eat();
      try {
        const num = Rational.parse(token.value);
        return { type: "scalar", value: num };
      } catch (e) {
        const e2 = new ValueExpressionEvalError(
          `Number literal "${token.value}" cannot be parsed as a valid Rational.`,
          this.input
        );
        e2.cause = e;
        throw e2;
      }
    }
    if (token.type === "amount") {
      this.eat();
      const amt = this.parseAmountFunc(token.value, this.currencyProvider);
      if (amt instanceof Error) throw amt;
      return { type: "amount", value: amt };
    }
    if (token.type === "string") {
      if (!inFunctionArg) {
        throw new ValueExpressionEvalError("String literal is only allowed in function arguments", this.input);
      }
      this.eat();
      return { type: "string", value: token.value };
    }
    if (token.type === "paren" && token.value === "(") {
      this.eat(); // consume '('
      const expr = this.parseExpression(inFunctionArg);
      const closing = this.current();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new ValueExpressionEvalError("Expected ')'", this.input);
      }
      this.eat(); // consume ')'
      return expr;
    }
    if (token.type === "identifier") {
      const ident = token.value;
      this.eat(); // consume identifier
      if (this.current() && this.current()!.type === "paren" && this.current()!.value === "(") {
        this.eat(); // consume '('
        const args: EvalValue[] = [];
        if (this.current() && !(this.current()!.type === "paren" && this.current()!.value === ")")) {
          while (true) {
            // In function arguments, allow string literals.
            const arg = this.parseExpression(true);
            args.push(arg);
            if (this.current() && this.current()!.type === "comma") {
              this.eat(); // consume comma
            } else {
              break;
            }
          }
        }
        if (!this.current() || this.current()!.type !== "paren" || this.current()!.value !== ")") {
          throw new ValueExpressionEvalError("Expected ')' after function arguments", this.input);
        }
        this.eat(); // consume ')'

        // Function evaluation:

        switch (ident) {
          case "DEBUG_IDENTITY":
            return new DebugIdentityFunction().evaluate(args, this.input);
          case "round":
            return new RoundFunction().evaluate(args, this.input);
          case "ceil":
            return new CeilFunction().evaluate(args, this.input);
          case "floor":
            return new FloorFunction().evaluate(args, this.input);
        }

        throw new ValueExpressionEvalError(`Unsupported function '${ident}'`, this.input);
      }
      throw new ValueExpressionEvalError(`Unexpected identifier '${ident}'`, this.input);
    }
    throw new ValueExpressionEvalError(`Unexpected token '${token.value}'`, this.input);
  }
}