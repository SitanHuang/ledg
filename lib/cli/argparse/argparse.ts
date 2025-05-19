export class ArgParseError extends Error {
  protected readonly __argParseErrorBrand = undefined;
}
export class HelpRequested extends ArgParseError {
  protected readonly __helpRequestedBrand = undefined;
}

export class Token {
  constructor(
    public readonly raw: string,
    public readonly escaped = false, // whether after the "--" escape
  ) {}
}

export type Positionals = Token[];