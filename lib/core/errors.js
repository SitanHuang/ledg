const err_ignores_list = {
  "invalid-price-declaration": false,
  "unknown-book-directive": false,
  "imbalanced-entries": false,
  "invalid-amount-format": false
};

function err_set_ignores_list(str) {
  str = typeof str != 'string' ? '' : str;
  let args = str.split(",");
  for (let arg of args) {
    arg = arg.trim();
    if (arg == 'all') {
      for (let key in err_ignores_list)
        err_ignores_list[key] = true;
      return;
    }
    err_ignores_list[arg] = true;
  }
}


function err_rethrow(newError, oldError) {
  newError.original = oldError;
  newError.stack = newError.stack.split('\n').slice(0,2).join('\n') + '\n' +
            oldError.stack;
  throw newError;
}

class LedgError extends Error {
  constructor(message) {
    super(message);
    this.name = "LedgError";
  }
}

class EntryImbalancedError extends LedgError {
  constructor(message) {
    super(message);
    this.name = "EntryImbalancedError";
  }
}
