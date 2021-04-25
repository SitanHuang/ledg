
async function cmd_history(args) {
  args.flags.avg = args.flags.avg !== false;

  if (args.flags['skip-book-close'] !== false)
    args.flags['skip-book-close'] = true;

  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = undefined;

  let int = report_get_reporting_interval(args);
  let showDays = true;
  let showMonth = true;
  let showWeeks = int[2] >= 7 && int[2] % 7 == 0;
  let showQuarter = int[1] >= 3 && int[1] % 3 == 0;

  if (int[2] > 0 && int[2] < 7) {
    cmd_report_modifiers.from = '@month-start';
    cmd_report_modifiers.to = '@tomorrow';
  } else if (showWeeks) {
    cmd_report_modifiers.from = '@year-start';
    cmd_report_modifiers.to = '@month-end';
  } else {
    cmd_report_modifiers.from = '@last-year';
    cmd_report_modifiers.to = '@month-end';
  }
  report_set_modifiers(args);
  report_set_accounts(args);
  report_compile_account_regex();

  args.modifiers.from = cmd_report_modifiers.from;
  args.modifiers.to = cmd_report_modifiers.to;

  let eop = args.flags['valuation-eop'];

  let skipTo;
  args.flags['skip'] &&
     (skipTo = report_replaceDateStr(args.flags['skip'])) &&
     !isNaN(skipTo = Date.parse(skipTo + 'T00:00:00'));

  let strF = report_replaceDateStr(args.modifiers.from);
  let strT = report_replaceDateStr(args.modifiers.to);
  let from = Date.parse(strF + 'T00:00:00');
  let to = Date.parse(strT + 'T00:00:00');

  let dateFunctions = [];

  let crntD = new Date(from);
  while (crntD < to) {
    let a = Math.floor(crntD.getTime() / 1000);
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    let b = Math.floor(Math.min(crntD.getTime(), to) / 1000);
    dateFunctions.push(t => t >= a && t < b);
  }

  report_extract_account(args);
  report_extract_tags(args);

  if (DEBUG)
    console.debug(args);


  let accounts = args.accounts.length ?
                   [...args.accounts.map((x, i) => { return { q: x, name: args.accountSrc[i], sum: new Money(), val: Array(dateFunctions.length).fill(new Money()) } })] :
                   [...Object.keys(cmd_report_accounts).map(x => { return { name: x, q: cmd_report_accounts_compiled[x], sum: new Money(), val: Array(dateFunctions.length).fill(new Money()) } })];

  delete args.accounts; // so report_traverse don't handle accounts

  let sums = Array(accounts.length).fill(1).map(x => new Money());
  await report_traverse(args, async function (entry) {
    let i = 0;
    let matched = false;
    for (;i < dateFunctions.length;i++) {
      if (dateFunctions[i](entry.time)) {
        matched = true;
        break;
      }
    }
    if (!matched) return; // outside date range
    let j = 0;
    for (let acc of accounts) {
      let q = acc.q;

      for (let t of entry.transfers) {
        if (t[1].match(q)) {
          let converted = t[2];
          if (!eop)
            converted = converted.tryConvertArgs(args, entry.time);
          acc.val[i] = acc.val[i].plus(converted);
          acc.sum = acc.sum.plus(converted);
          if (!skipTo || entry.time >= Math.floor(skipTo / 1000))
            sums[j] = sums[j].plus(converted);
        }
      }
      j++;
    }
  });

  let table = [];
  let align = [];
  if (!args.flags.epoch && !args.flags.isofull && !args.flags.iso) {
    table.push(['Year']);
    align.push(TAB_ALIGN_RIGHT);
    if (showQuarter) { table[0].push('Quarter'); align.push(TAB_ALIGN_LEFT) }
    if (showMonth) { table[0].push('Month'); align.push(TAB_ALIGN_LEFT) }
    if (showWeeks) { table[0].push('Week'); align.push(TAB_ALIGN_RIGHT) }
    if (showDays) { table[0].push('Day');  align.push(TAB_ALIGN_RIGHT)}
  } else {
    table.push(['Time']);
    align.push(TAB_ALIGN_RIGHT);
  }
  let tab_left_length = table[0].length;


  let cu_accounts = [];

  if (typeof args.flags['cumulative-columns'] != 'undefined') {
    let sp = args.flags['cumulative-columns'].toString().split(',').map(x => parseInt(x));
    for (let n of sp) {
      if (isNaN(n)) {
        console.log(`Error: "${n}" is not a column number. Use this format: --cumulative-columns=1,2,3`);
        return 1;
      }
      cu_accounts.push(n - 1);
    }
  }
  accounts.forEach((x, i) => {
    table[0].push(x.name[0].toUpperCase() + x.name.substring(1));
    align.push(TAB_ALIGN_RIGHT);
    if (args.flags.cumulative || cu_accounts.indexOf(i) >= 0) {
      x.val.forEach((z, j) => {
        if (j == 0) return;
        x.val[j] = x.val[j].plus(x.val[j - 1]);
      });
    }
  });

  let fromYear = new Date(from).getFullYear();
  let toYear = new Date(to).getFullYear();
  let fromMonth = new Date(from).getMonth();
  let toMonth = new Date(to).getMonth();

  crntD = new Date(from);
  let r = table.length - 2;
  let last = [];
  while (crntD < to) {
    r++;
    if (skipTo && crntD < skipTo) {
      crntD.setFullYear(crntD.getFullYear() + int[0]);
      crntD.setMonth(crntD.getMonth() + int[1]);
      crntD.setDate(crntD.getDate() + int[2]);
      continue;
    }
    let row = [];

    if (args.flags.epoch) {
      row.push(crntD.getTime().toString());
    } else if (args.flags.isofull) {
      row.push(crntD.toISOString().split('T')[0]);
    } else if (args.flags.iso) {
      let date = crntD.toISOString().split('T')[0];
      if (fromYear == toYear) {
        date = date.substr(5);
        if (fromMonth == toMonth)
          date = date.substr(3);
      }
      row.push(date.replace(/-01$/, ''));
    } else {
      row.push(crntD.getFullYear().toString());
      if (showQuarter) row.push(print_full_quarter(crntD.getMonth()));
      if (showMonth) row.push(print_full_month(crntD.getMonth()));
      if (showWeeks) row.push(pring_week(crntD));
      if (showDays) row.push(crntD.getDate());

      if (r == dateFunctions.length - 1) { // last entry
        row[row.length - 1] = '≥ ' + row[row.length - 1];
      }

      let current = Array.from(row);
      let lastChanged = !!args.flags.csv;
      for (let i = 0;i < row.length;i++) {
        if (table[0][i] == 'Day') continue;
        if (!lastChanged && (current[i] == last[i])) row[i] = '';
        else if (current[i] != last[i]) lastChanged = true;
      }
      last = current;
    }

    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);

    let i = 0;
    for (let acc of accounts) {
      let v = acc.val[r];

      if (eop)
        v = v.tryConvertArgs(args, Math.floor(crntD / 1000) - 1);

      if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense ||
          args.flags.invert)
        v = v.timesPrim(-1);

      row.push(v.colorFormat(dp));
    }

    table.push(row);
  }

  if (!args.flags.csv) {
    table.push([]);
    let rowL = table[table.length - 2].length;
    if (args.flags.avg) {
      let avg = [];
      for (let i = 0;i < rowL;i++) {
        let j = i - (rowL - accounts.length);
        if (j < -1) {
          avg.push('');
        } else if (j == -1) {
          avg.push('Avg');
        } else {
          let acc = accounts[j];
          let v = acc.sum.divPrim(dateFunctions.length);

          if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense ||
            args.flags.invert) {
            v = v.timesPrim(-1);
          }

          avg.push(v.colorFormat(isNaN(dp) ? 2 : dp));
        }
      }
      table.push(avg);
    }
    if (args.flags.sum) {
      let asum = [];
      if (args.flags.sum === true)
        asum = Array(accounts.length).fill(1).map((x, i) => i);
      else
        asum = args.flags.sum.toString().split(/\s*,\s*/).map(x => parseInt(x) - 1).filter(x => x >= 0);
      let sum = [];
      for (let i = 0;i < rowL;i++) {
        let j = i - (rowL - accounts.length);
        if (j < -1)
          sum.push('');
        else if (j == -1)
          sum.push('Sum');
        else {
          if (asum.indexOf(j) >= 0) {
            let acc = accounts[j];
            if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense ||
              args.flags.invert) {
              sums[j] = sums[j].timesPrim(-1);
            }
            sum.push(sums[j].colorFormat(isNaN(dp) ? 2 : dp));
          } else
            sum.push('');
        }
      }
      table.push(sum);
    }


    console.log(`Reporting from ${c.bold(strF)} to ${c.bold(strT)}\n`);
  }

  console.log(tabulate(table, {
    align: align
  }));
}
