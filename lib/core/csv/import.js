async function import_csv_exec(code, path) {
  code = code.toString();
  let ctx = {
    delimeter: ",",
    dateformat: "MM/DD/YYYY",
    row: [],
    bail: false,
    default_account: "Expense.Unknown",
    ___skip: 0, // stores lines to skip
    ___callback: () => {},
  };
  ctx.process = (callback) => {
    ctx.___callback = callback;
  };
  ctx.skip = (lines=0) => {
    ctx.___skip = lines;
  };
  ctx.col = (c=1) => (ctx.row[c - 1] || '');
  // adding spaces prevents add cmd from recognizing it as an account
  ctx.description = (x) => '   ' + (x || '').toString() + '   ';
  ctx.date = (x) => {
    let d = dayjs(x, ctx.dateformat).$d.getTime();
    if (!d)
      throw `CSV Parser: invalid date (${x}) against dateformat ${ctx.dateformat}`;
    return entry_datestr(d / 1000);
  };

  ctx.trim = (...args) => {
    if (args.length)
      args.forEach(x => ctx.row[x] = ctx.row[x].trim());
    else
      ctx.row = ctx.row.map(x => x.trim());
    return '';
  }

  ctx.cleared = () => '*';
  ctx.pending = () => '!';

  ctx.modifier = (a, b) => a + ':' + b;

  let parseMoney = (x) => {
    let a;
    if (!(a = Money.parseMoney(x)))
      throw `CSV Parser: ${x} is not a valid amount`;
    return a;
  };
  ctx.amount = (x) => parseMoney(x).serialize(true);
  ctx.invert = (x) => parseMoney(x).timesPrim(-1).serialize(true);

  ctx.account = (x, map, def) => {
    if (!map)
      return x || ctx.default_account;
    for (let q in map)
      if (x.match(new RegExp(q, 'i')))
        return map[q];
    return def || ctx.default_account;
  };
  ctx.transfer = (...args) => args;

  let cmds = [];

  ctx.add = (...args) => cmds.push(args.flat());

  // eval('() => {' + code + '}').call(ctx);
  with (ctx)
    eval(code)

  await fs_read_csv(path, row => {
    ctx.row = row[0] || [];
    if (ctx.___skip) {
      ctx.___skip--;
      return;
    }

    try {
      ctx.___callback.call(ctx);
    } catch (e) {
      if (ctx.bail)
        throw e;
    }
  }, ctx.delimeter);

  return cmds;
}
