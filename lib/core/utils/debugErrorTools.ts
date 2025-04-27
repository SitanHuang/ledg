/**
 * Recursively collects all messages from an Error and its causes into a single formatted string.
 *
 * @param error - The Error (or any value) to process.
 * @param indent - Current indentation level (used internally; callers can omit it).
 * @returns A single string with each message (and sub-causes) on its own line, indented.
 */
export function getErrorMessages(
  error: unknown,
  indent = 0
): string {
  const pad = ' '.repeat(indent);

  if (error instanceof Error) {
    let output = `${pad}${error.name}: ${error.message}`;

    const cause = error.cause;
    if (cause !== undefined) {
      if (cause instanceof Error) {
        output += `\n${pad}Caused by:\n` +
          getErrorMessages(cause, indent + 2);
      } else {
        output += `\n${pad}Caused by: ${String(cause)}`;
      }
    }

    return output;
  }

  return `${pad}${String(error)}`;
}
