var cmd_report_modifiers = {
  from: "@year-start", // inclusive 
  to: "@year-end", // exclusive
};

function report_set_modifiers(args) {
  Object.keys(cmd_report_modifiers).forEach(x => {
    cmd_report_modifiers[x] = args.modifiers[x] || cmd_report_modifiers[x];
  });
}

var CMD_MODIFER_REPLACE = {
  "@year-start": () => new Date(new Date().getFullYear(), 0, 1) / 1000 | 0,
  "@min": () => fs_data_range.length ? (Date.parse(fs_data_range[0] + '-01-01T00:00:00') / 1000 | 0) : 0,
  "@max": () => (fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000) / 1000 | 0,
  "@year-end": () => new Date(new Date().getFullYear() + 1, 0, 1) / 1000 | 0,
  "@month-start": () => new Date(new Date().getFullYear(), new Date().getMonth(), 1) / 1000 | 0,
  "@month-end": () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0) / 1000 | 0,
  "@today": () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0) / 1000 | 0,
  "@tomorrow": () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 0, 0, 0, 0) / 1000 | 0,
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
  await data_iterate_books(range, async function (book) {
    let len = book.length;
    WHILE: while (len--) {
      if ((book[len].time >= (f / 1000 | 0)) && (book[len].time < t / 1000 | 0)) {
        for (mod in args.modifiers) {
          if (ignored.indexOf(mod) < 0 && args.modifiers[mod] != book[len][mod]) continue WHILE;
        }
        await callback(book[len]);
      }
    }
  }, afterOpenCallback);
}

async function report_sum_accounts(args, sum_parent) {
  cmd_report_modifiers.from = args.modifiers.from; // unless specified, query everything
  cmd_report_modifiers.to = args.modifiers.to;
  
  let d;
  await report_traverse(args, async function(entry) {
    for (let t of entry.transfers) {
      if (sum_parent) {
        let levels = t[1].split(".");
        let previous = "";
        for (let l of levels) {
          let k = previous + l;
          if (!d[k]) d[k] = new Big(0);
          d[k] = d[k].plus(t[2]);
          previous = k + ".";
        }
      } else {
        d[t[1]] = d[t[1]].plus(t[2]);
      }
    }
  }, async function() { // wait until books are opened to load accounts
    
    d = JSON.parse(JSON.stringify(data.accounts));
    Object.keys(d).forEach(x => d[x] = new Big(0));
  });
  
  Object.keys(d).forEach(x => d[x] = d[x].toNumber());
  return d;
}

function report_replaceDateStr(dateStr) {
  if (CMD_MODIFER_REPLACE[dateStr]) return new Date(CMD_MODIFER_REPLACE[dateStr]() * 1000).toISOString().split('T')[0];
  return dateStr;
}
