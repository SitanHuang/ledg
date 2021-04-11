
class FSError extends LedgError {
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
