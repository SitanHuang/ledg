export class SourceableError extends Error {
  public readonly sourceString: string;

  constructor(message: string, sourceString: string) {
    super(message);
    this.sourceString = sourceString;
  }
}