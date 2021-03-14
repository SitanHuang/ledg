function argsparser(_args) {
  let args = { _:[], flags: {}, modifiers: {} };
  for (let i = 0;i < _args.length;i++) {
    let arg = _args[i];
    let match;
    if (match = arg.match(/^--?([^=]+)(=(.*))?$/)) {
      let key = match[1];
      let val = match[3] || true;
      args.flags[key] = val;
    } else if (match = arg.match(/^([^:]+):(.*)$/)) {
      args.modifiers[match[1]] = match[2];
    } else {
      args._.push(arg)
    }
  }
  return args;
}
