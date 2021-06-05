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

/*
 * users can pass --test="JS code" to filter entries
 *
 * compiles the js code and produces a function
 * containing the code
 */
function report_compile_test_func(args) {
  if (args.flags.test?.length) {
    args.testFunc = eval(
      `(e) => {
         with(e) {
           report_testFuncMacrosContext._entry = e;
           with(report_testFuncMacrosContext)
            return (${args.flags.test})
         }
        }`);
    if (DEBUG)
      console.debug(`args.testFunc compile => ${args.testFunc}`);
  }
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
  let int = args.flags.interval;
  if (typeof int != 'undefined') {
    if (!int.toString().match(/^\d+,\d+,\d+$/))
      throw `Invalid --interval: please use --interval=y,m,d`;
    return int.split(',').map(x => parseInt(x));
  }

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
    (a.time - b.time)/* ||
    // if no difference (0)
    (a.clockOut && b.clockOut &&
    (a.clockOut.toString().localeCompare(b.clockOut.toString()))) ||
    (a.clockIn && b.clockIn &&
    (a.clockIn.toString().localeCompare(b.clockIn.toString())))*/
  );
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

var CMD_MODIFER_REPLACE;
{
  let _now = new Date();
  CMD_MODIFER_REPLACE = {
    "@year-start": () => Math.floor(new Date(_now.getFullYear(), 0, 1) / 1000),
    "@min": () => fs_data_range.length ? Math.floor(Date.parse(fs_data_range[0] + '-01-01T00:00:00') / 1000) : 0,
    "@max": () => Math.floor((fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(_now.getFullYear() + 1, 0, 1) - 1000) / 1000),
    "@year-end": () => Math.floor(new Date(_now.getFullYear() + 1, 0, 1) / 1000),
    "@month-start": () => Math.floor(new Date(_now.getFullYear(), _now.getMonth(), 1) / 1000),
    "@month-end": () => Math.floor(new Date(_now.getFullYear(), _now.getMonth() + 1, 1) / 1000),
    "@today": () => Math.floor(new Date(_now.getFullYear(), _now.getMonth(), _now.getDate(), 0, 0, 0, 0) / 1000),
    "@tomorrow": () => Math.floor(new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + 1, 0, 0, 0, 0) / 1000),
    "@last-year-today": () => {
      let a = new Date();
      a.setFullYear(a.getFullYear() - 1);
      return Math.floor(a / 1000);
    },
    "@last-year": () => Math.floor(new Date(_now.getFullYear() - 1, 0, 1) / 1000)
  };
}

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
  let noMod = [];
  for (let mod in args.modifiers) {
    if (ignored.indexOf(mod) >= 0)
      continue;
    if (args.modifiers[mod] === null)
      noMod.push(mod);
    else if (typeof args.modifiers[mod] != 'undefined' &&
      args.modifiers[mod].toString().length)
      regexMod[mod] = new RegExp(args.modifiers[mod], 'i');
  }
  report_compile_test_func(args);

  await data_iterate_books(range, async function (book) {
    let len = -1;
    WHILE: while (++len < book.length) {
      let entry = book[len];
      if ((entry.time >= Math.floor(f / 1000)) && (entry.time < Math.floor(t / 1000))) {
        if ((entry.virt && args.flags.real) ||
            (entry.pending && args.flags.cleared))
          continue WHILE;

        if (args.testFunc && !args.testFunc(entry))
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
        for (let mod in regexMod) {
          if (!entry[mod])
            if (regexMod[mod].source == '(?:)')
              continue; // empty on both
            else
              continue WHILE;

          if (!(entry[mod].toString()).match(regexMod[mod]))
            continue WHILE;
        }
        for (let mod of noMod)
          if (entry[mod])
            continue WHILE;
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
    d = {};
    Object.assign(d, forkAccList || data.accounts);
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

  if (!dateStr?.length)
    return dateStr;

  let date = Sugar.Date.create(dateStr);

  if (DEBUG)
    console.debug(`smart date: ${dateStr} => ${date}`);

  if (isNaN(date))
    throw `${dateStr} is not in ISO format nor parsable by smart date parser`;

  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0, 0);

  return entry_datestr(date.getTime() / 1000);
}

function report_transform_mindepth(acc, depth) {
  return acc.split('.').slice(Math.max(depth - 1, 0) || 0).join('.');
}

function report_transform_mindepth_obj(obj, depth) {
  let c = {};
  for (let key in obj) {
    let k2 = report_transform_mindepth(key, depth);
    if (k2.length)
      c[k2] = obj[key];
  }
  return c;
}

function report_proc_period_opts(args, period) {
  if (!period)
    return;

  let dates = period.toString().split(/->| - |\.\.\.*| to /);

  let parsed;

  if (dates.length && !isNaN(parsed = Sugar.Date.create(dates[0])))
    args.modifiers.from = entry_datestr(parsed.getTime() / 1000) ||
                          args.modifiers.from;
  else
    throw `smart date: --period requires a start date, and ${period} cannot be parsed`;

  if (!isNaN(parsed = Sugar.Date.create(dates[1])))
    args.modifiers.to = entry_datestr(parsed.getTime() / 1000) ||
                        args.modifiers.to;
  else if (dates[1].length)
    throw `smart date: second date of --period, ${dates[1]}, cannot be parsed`;
}
