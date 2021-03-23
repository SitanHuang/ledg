/*
 * query : {
 *   [from: time,] // min (for opening books)
 *   [to: time,] // max (for opening books)
 *   queries: [{
 *     [type: "query",] // standalone query that doesn't involve other queries
 *     from: time,
 *     to: time,
 *     modifiers: {},
 *     flags: {},
 *     accounts: [], // for filtering entries
 *     [sum_accounts: []], // sum only these accounts
 *     collect: [
 *       'sum', // sum to data
 *       'count', // count entries
 *       'entries', // return entries
 *       'accounts_sum', // returns { acc_trans: sum }
 *     ]
 *   }]
 * }
 */
async function query_exec(query) {
  if (!query.queries.length) return [];
  let data = [];
  let _range_min = query.from;
  let _range_max = query.to;
  const ignoredMods = Object.keys(cmd_report_modifiers);
  for (let q of query.queries) {
    q.modifiers = q.modifiers || {};
    q.accounts = q.accounts || {};
    q.flags = q.flags || {};

    let regexMod = {};
    for (mod in q.modifiers) {
      if (ignoredMods.indexOf(mod) >= 0) continue;
      if (q.modifiers[mod]) regexMod[mod] = new RegExp(q.modifiers[mod], 'i');
    }
    q.regexMod = regexMod;

    let d = {};
    data.push(d);

    q.from = q.from || _range_min || 0;
    q.to = q.to || _range_max || 0;
    if (isNaN(_range_min)) _range_min = q.from;
    if (isNaN(_range_max)) _range_max = q.to;
    _range_min = Math.min(_range_min, q.from);
    _range_max = Math.max(_range_max, q.to);

    for (let c of q.collect) {
      switch (c) {
        case 'sum':
          d.sum = new Big(0);
          break;
        case 'count':
          d.count = 0;
          break;
        case 'entries':
          d.entries = [];
          break;
        case 'accounts_sum':
          d.accounts_sum = {};
          break;
        default:
          throw `Unknown collect method: ${c}`;
      }
    }
  }

  await data_iterate_books(data_books_required(_range_min * 1000, _range_max * 1000),
    async function (book) {
    let len = book.length;
    ENTRY: while (len--) {
      let e = book[len];
      if (e.time < query.from || e.time >= query.to) continue;
      let i = -1;
      QUERY: for (let q of query.queries) {
        i++;
        // handle flags
        if (q.flags['skip-book-close'] && e.bookClose && e.bookClose.toString() == 'true') continue QUERY;
        // handle time
        if ((q.from && e.time < q.from) || (q.to && e.time >= q.to)) continue;
        // handle modifiers
        for (mod in q.regexMod) {
          if (!e[mod]) {
            if (q.regexMod[mod].source == '(?:)') continue; // empty on both
            else continue QUERY;
          }
          if (!(e[mod].toString()).match(q.regexMod[mod])) continue QUERY;
        }
        // handle accounts && transfer sums & sum & count
        let sumTrans = q.collect.indexOf('accounts_sum') >= 0;
        let isSum = q.collect.indexOf('sum') >= 0;
        let sum = isSum ? new Big(0) : undefined;
        let sum_parent = q.flags['sum-parent'];
        let accSum = {};
        let matchTimes = 0;
        let broken = false;
        FOR: for (let qt of q.accounts) {
          for (let t of e.transfers) {
            if (t[1].match(qt)) {
              if (!broken) matchTimes++;
              broken = true;
              if (isSum) {
                sum = sum.plus(t[2]);
              }
            }
          }
        }
        if (matchTimes != q.accounts.length) continue QUERY;
        if (isSum || sumTrans) {
          for (let t of e.transfers) {
            if (sumTrans) {
              if (sum_parent) {
                let levels = t[1].split(".");
                let previous = "";
                for (let l of levels) {
                  let k = previous + l;
                  if (!accSum[k]) accSum[k] = new Big(0);
                  accSum[k] = accSum[k].plus(t[2]);
                  previous = k + ".";
                }
              } else {
                accSum[t[1]] = (accSum[t[1]] || new Big(0)).plus(t[2]);
              }
            }
            if (isSum && q.accounts.length == 0) sum = sum.plus(t[2]);
          }
        }
        // ======= done filtering =======
        // store entries
        if (q.collect.indexOf('entries') >= 0) {
          data[i].entries.push(e);
        }
        // store rest of results
        for (let x in accSum) { accSum[x] = accSum[x].toNumber() }
        if (sumTrans) data[i].accounts_sum = accSum;
        if (isSum) data[i].sum = data[i].sum.plus(sum);
        data[i].count++;
      }
    }

  });

  for (let i = 0;i < data.length;i++) {
    let d = data[i];
    d.sum = d.sum && d.sum.toNumber();
    if (query.cumulative && i - query.cumulative >= 0) {
      let prev = data[i - query.cumulative];
      for (let key in prev) {
        if (!isNaN(prev[key]))
          data[i][key] = new Big(prev[key]).add(data[i][key]).toNumber();
      }
    }
    if (!isNaN(d.sum)) data.minSum = Math.min(d.sum, data.minSum || 0);
    if (!isNaN(d.count)) data.minCount = Math.min(d.count, data.minCount || 0);
    if (!isNaN(d.sum)) data.maxSum = Math.max(d.sum, data.maxSum || 0);
    if (!isNaN(d.count)) data.maxCount = Math.max(d.count, data.maxCount || 0);
  }
  return data;

}

function query_args_to_filter(args) {
  report_extract_account(args);
  report_extract_tags(args);
  let x = {
    modifiers: args.modifiers,
    flags: args.flags,
    accounts: args.accounts
  };
  x.from = (Date.parse(report_replaceDateStr(args.modifiers.from || '@min') + 'T00:00:00') / 1000 | 0);
  x.to = (Date.parse(report_replaceDateStr(args.modifiers.to || '@max') + 'T00:00:00') / 1000 | 0);
  return x;
}
