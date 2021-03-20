function argsparser(_args) {
  let args = { _:[], flags: {}, modifiers: {} };

  let uuids = [];

  let bypass = false;
  for (let i = 0;i < _args.length;i++) {
    let arg = _args[i];

    if (arg == '--') { bypass = true; continue; }
    if (bypass) { args._.push(arg); continue; }

    let match;
    if (match = arg.match(/^[a-z0-9]{8}$/i)) {
      uuids.push(arg);
    } else if (match = arg.match(/^-([a-zA-Z])(.+)$/)) {
      args.flags[match[1]] = match[2];
    } else if (match = arg.match(/^--?([^=]+)(=(.*))?$/)) {
      let key = match[1];
      if (!isNaN(Number(key))) { // key cannot be number
        args._.push(arg);
        continue;
      }
      let val = match[3] || (arg.indexOf('=') > 0 ? '' : true);
      if (!isNaN(Number(val))) val = Number(val);
      if (val == 'true') val = true;
      if (val == 'false') val = false;
      args.flags[key] = val;
    } else if (match = arg.match(/^([a-zA-Z_]+):(.*)$/)) {
      args.modifiers[match[1]] = match[2];
    } else {
      args._.push(arg)
    }
  }
  if (uuids.length) args.modifiers['uuid'] = args.modifiers.uuid || uuids.join("|");
  args._ = args._.filter(x => x.length);
  return args;
}
