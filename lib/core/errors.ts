export class SourceableError extends Error {
  protected readonly __sourceableErrorBrand = undefined;

  public readonly sourceString: string;
  public readonly line?: number;
  public readonly column?: number;

  constructor(message: string, sourceString: string, line?: number, column?: number) {
    super(message);
    this.sourceString = sourceString;
    this.line = line;
    this.column = column;

    this.message = this.buildFullMessage();
  }

  buildFullMessage(): string {
    if (this.sourceString === undefined) {
      return this.message;
    }

    const lines = this.sourceString.split(/\r?\n/);
    const lineIndex = this.line ?? 0;

    const sourceLine = lines[lineIndex] ?? this.sourceString;

    let pointerLine = "";
    if (this.column != null && this.column > 0) {
      const caretPos = Math.min(this.column - 1, sourceLine.length);
      pointerLine = " ".repeat(caretPos) + "^";
    }

    const location = `Line ${this.line}` + (this.column != null ? `, Column ${this.column}` : "");
    let result = `${this.message} (${location})`;

    if (sourceLine) {
      result += `\n${sourceLine}`;
      if (pointerLine) result += `\n${pointerLine}`;
    }

    return result;
  }
}