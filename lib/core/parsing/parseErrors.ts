import { SourceableError } from "../errors.ts";

/**
 * A base error type for all parsing errors.
 */
export abstract class ParseError extends SourceableError {
  constructor(message: string, sourceString: string) {
    super(message, sourceString);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Errors occurring during Amount parsing.
 */
export class AmountParseError extends ParseError {
  constructor(message: string, sourceString: string) {
    super(message, sourceString);
    this.name = "AmountParseError";
  }
}

export class ValueExpressionEvalError extends AmountParseError {
  constructor(message: string, sourceString: string) {
    super(message, sourceString);
    this.name = "ValueExpressionEvalError";
  }
}
