/**
 * A base error type for all parsing errors.
 */
export abstract class ParseError extends Error {
  public readonly sourceString: string;

  constructor(message: string, sourceString: string) {
    super(message);
    this.sourceString = sourceString;
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
