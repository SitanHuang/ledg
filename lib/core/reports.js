var cmd_report_modifiers = {
  from: "@year-start", // inclusive
  to: "@year-end", // exclusive
};

var cmd_report_accounts = {
  income: 'Income*',
  expense: 'Expense*',
  asset: 'Asset*',
  liability: 'Liability*',
  equity: 'Equity*'
};

var cmd_report_accounts_compiled = {};

function report_set_accounts(args) {
  Object.keys(cmd_report_accounts).forEach(x => {
    cmd_report_accounts[x] = args.flags[x] || cmd_report_accounts[x];
  });
}

function report_compile_account_regex() {
  Object.keys(cmd_report_accounts).forEach(x => {
    cmd_report_accounts_compiled[x] = fzy_compile(cmd_report_accounts[x]);
  });
}

function report_set_modifiers(args) {
  Object.keys(cmd_report_modifiers).forEach(x => {
    cmd_report_modifiers[x] = args.modifiers[x] || cmd_report_modifiers[x];
  });
}

function report_get_reporting_interval(args, rtnNull) {
  // adds to new Date(y, m, d)
  // default: monthly
  let def = [0, 1, 0];

  if (args.flags.yearly) def = [1, 0, 0];
  else if (args.flags.quarterly) def = [0, 3, 0];
  else if (args.flags.monthly) def = [0, 1, 0];
  else if (args.flags.biweekly) def = [0, 0, 14];
  else if (args.flags.weekly) def = [0, 0, 7];
  else if (args.flags.daily) def = [0, 0, 1];
  else if (rtnNull) return;

  return def;
}

function report_sort_by_time(entries) {
  return entries = entries.sort((a, b) =>
    (a.time - b.time) ||
    // if no difference (0)
    (a.clockOut && b.clockOut &&
    (a.clockOut.toString().localeCompare(b.clockOut.toString()))));
}

function report_extract_account(args) {
  args.accounts = args.accounts || [];
  args.accountSrc = args.accountSrc || [];

  let v = args._;
  for (let i = 0;i < v.length;i++)
    if (isArgAccount(v[i])) {
      args.accounts.push(fzy_compile(v[i]));
      args.accountSrc.push(v[i]);
      v.splice(i, 1);
      i--;
    }
}

function report_extract_tags(args) {
  if (args.modifiers.tags)
    return;
  let tags = [];
  let v = args._;
  for (let i = 0;i < v.length;i++)
    if (v[i].startsWith('+')) {
      tags.push(v[i].substring(1));
      v.splice(i, 1);
      i--;
    }

  if (!tags.length)
    return;
  args.modifiers.tags = tags.join("(,|$)|") + "(,|$)";
}

var CMD_MODIFER_REPLACE = {
  "@year-start": () => new Date(new Date().getFullYear(), 0, 1) / 1000 | 0,
  "@min": () => fs_data_range.length ? (Date.parse(fs_data_range[0] + '-01-01T00:00:00') / 1000 | 0) : 0,
  "@max": () => (fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000) / 1000 | 0,
  "@year-end": () => new Date(new Date().getFullYear() + 1, 0, 1) / 1000 | 0,
  "@month-start": () => new Date(new Date().getFullYear(), new Date().getMonth(), 1) / 1000 | 0,
  "@month-end": () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) / 1000 | 0,
  "@today": () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0) / 1000 | 0,
  "@tomorrow": () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 0, 0, 0, 0) / 1000 | 0,
  "@last-year-today": () => {
    let a = new Date();
    a.setFullYear(a.getFullYear() - 1);
    return a / 1000 | 0;
  },
  "@last-year": () => new Date(new Date().getFullYear() - 1, 0, 1) / 1000 | 0
};

/*
 * IMPORTANT: callback must be async
 */
async function report_traverse(args, callback, afterOpenCallback) {
  let min_f = fs_data_range.length ? Date.parse(fs_data_range[0] + '-01-01T00:00:00') : 0;
  let f = Date.parse(report_replaceDateStr(cmd_report_modifiers.from) + 'T00:00:00') || min_f;
  let max_t = fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000;
  let t = Date.parse(report_replaceDateStr(cmd_report_modifiers.to) + 'T00:00:00') - 1000 || max_t;
  let range = data_books_required(f, t);
  let ignored = Object.keys(cmd_report_modifiers);

  let regexMod = {};
  for (mod in args.modifiers) {
    if (ignored.indexOf(mod) >= 0)
      continue;
    if (args.modifiers[mod])
      regexMod[mod] = new RegExp(args.modifiers[mod], 'i');
  }

  await data_iterate_books(range, async function (book) {
    let len = book.length;
    WHILE: while (len--) {
      let entry = book[len];
      if ((entry.time >= (f / 1000 | 0)) && (entry.time < t / 1000 | 0)) {
        if (entry.virt && args.flags.real)
          continue WHILE;

        if (args.flags['skip-book-close'] &&
            entry.bookClose &&
            entry.bookClose.toString() == 'true')
          continue WHILE;

        if (args.accounts && args.accounts.length) {
          let matchTimes = 0;
          FOR:
          for (let q of args.accounts)
            for (let t of entry.transfers)
              if (t[1].match(q)) {
                matchTimes++;
                break;
              }


          if (matchTimes != args.accounts.length)
            continue WHILE;
        }
        for (mod in regexMod) {
          if (!entry[mod]) {
            if (regexMod[mod].source == '(?:)')
              continue; // empty on both
            else
              continue WHILE;
          }
          if (!(entry[mod].toString()).match(regexMod[mod]))
            continue WHILE;
        }
        await callback(entry);
      }
    }
  }, afterOpenCallback);
}

async function report_sum_accounts(args, sum_parent, forkAccList) {
  // unless specified, query everything
  cmd_report_modifiers.from = args.modifiers.from;
  cmd_report_modifiers.to = args.modifiers.to;

  let d;
  await report_traverse(args, async function(entry) {
    for (let t of entry.transfers)
      if (sum_parent) {
        let levels = t[1].split(".");
        let previous = "";
        for (let l of levels) {
          let k = previous + l;
          if (!d[k]) d[k] = new Money();
          d[k] = d[k].plus(t[2]);
          previous = k + ".";
        }
      } else {
        d[t[1]] = d[t[1]].plus(t[2]);
      }
  }, async function() {
    // wait until books are opened to load accounts
    d = JSON.parse(JSON.stringify(forkAccList || data.accounts));
    Object.keys(d).forEach(x => d[x] = new Money());
  });

  Object.keys(d).forEach(x => {
    if (args.accounts && args.accounts) {
      let matchTimes = 0;
      for (let q of args.accounts) {
        if (x.match(q)) {
          matchTimes++;
          break;
        }
      }
      if (matchTimes != args.accounts.length)
        delete d[x];
    }
  });
  return d;
}

function report_replaceDateStr(dateStr) {
  if (CMD_MODIFER_REPLACE[dateStr])
    return new Date(CMD_MODIFER_REPLACE[dateStr]() * 1000)
             .toISOString().split('T')[0];
  return dateStr;
}
