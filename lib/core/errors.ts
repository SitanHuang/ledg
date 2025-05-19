export class SourceableError extends Error {
  protected readonly __sourceableErrorBrand = undefined;

  public readonly sourceString: string;
  public readonly line?: number;
  public readonly column?: number;

  constructor(message: string, sourceString: string, line?: number, column?: number) {
    super(SourceableError.buildFullMessage(message, sourceString, line, column));
    this.sourceString = sourceString;
    this.line = line;
    this.column = column;
  }

  static buildFullMessage(message: string, sourceString: string, line?: number, column?: number): string {
    if (sourceString === undefined) {
      return message;
    }

    const lines = sourceString.split(/\r?\n/);
    const lineIndex = line ?? 0;

    const sourceLine = lines[lineIndex] ?? sourceString;

    let pointerLine = "";
    if (column != null && column > 0) {
      const caretPos = Math.min(column - 1, sourceLine.length);
      pointerLine = " ".repeat(caretPos) + "^";
    }

    const location = `Line ${line}` + (column != null ? `, Column ${column}` : "");
    let result = `${message} (${location})`;

    if (sourceLine) {
      result += `\n${sourceLine}`;
      if (pointerLine) result += `\n${pointerLine}`;
    }

    return result;
  }
}