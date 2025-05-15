export class SourceableError extends Error {
  protected readonly __sourceableErrorBrand = undefined;

  public readonly sourceString: string;

  constructor(message: string, sourceString: string) {
    super(message);
    this.sourceString = sourceString;
  }
}