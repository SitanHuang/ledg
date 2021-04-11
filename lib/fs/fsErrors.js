function err_rethrow(newError, oldError) {
  newError.original = oldError;
  newError.stack = newError.stack.split('\n').slice(0,2).join('\n') + '\n' +
            oldError.stack;
  throw newError;
}

class FSError extends Error {
  constructor(message) {
    super(message);
    this.name = "FSError";
  }
}

class IOError extends FSError {
  constructor(message) {
    super(message);
    this.name = "IOError";
  }
}

class ParseError extends FSError {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
}
