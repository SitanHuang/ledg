
async function cmd_history(args) {
  args.flags['skip-book-close'] = true;

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

  let strF = report_replaceDateStr(args.modifiers.from);
  let strT = report_replaceDateStr(args.modifiers.to);
  let from = Date.parse(strF + 'T00:00:00');
  let to = Date.parse(strT + 'T00:00:00');

  let dateFunctions = [];

  let crntD = new Date(from);
  while (crntD < to) {
    let a = crntD.getTime() / 1000 | 0;
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    let b = Math.min(crntD.getTime(), to) / 1000 | 0;
    dateFunctions.push(t => t >= a && t < b);
  }

  report_extract_account(args);
  report_extract_tags(args);

  let accounts = args.accounts.length ?
                   [...args.accounts.map((x, i) => { return { q: x, name: args.accountSrc[i], sum: new Big(0), val: Array(dateFunctions.length).fill(new Big(0)) } })] :
                   [...Object.keys(cmd_report_accounts).map(x => { return { name: x, q: cmd_report_accounts_compiled[x], sum: new Big(0), val: Array(dateFunctions.length).fill(new Big(0)) } })];

  delete args.accounts; // so report_traverse don't handle accounts

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
    for (let acc of accounts) {
      let q = acc.q;

      for (let t of entry.transfers) {
        if (t[1].match(q)) {
          acc.val[i] = acc.val[i].plus(t[2]);
          acc.sum = acc.sum.plus(t[2]);
        }
      }
    }
  });

  let table = [['Year']];
  let align = [TAB_ALIGN_RIGHT];
  if (showQuarter) { table[0].push('Quarter'); align.push(TAB_ALIGN_LEFT) }
  if (showMonth) { table[0].push('Month'); align.push(TAB_ALIGN_LEFT) }
  if (showWeeks) { table[0].push('Week'); align.push(TAB_ALIGN_RIGHT) }
  if (showDays) { table[0].push('Day');  align.push(TAB_ALIGN_RIGHT)}
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
    x.val = x.val.map(v => v.toNumber());
  });

  crntD = new Date(from);
  let last = [];
  while (crntD < to) {
    let r = table.length - 1;
    let row = [crntD.getFullYear().toString()];
    if (showQuarter) row.push(print_full_quarter(crntD.getMonth()));
    if (showMonth) row.push(print_full_month(crntD.getMonth()));
    if (showWeeks) row.push(pring_week(crntD));
    if (showDays) row.push(crntD.getDate());

    if (r == dateFunctions.length - 1) { // last entry
      row[row.length - 1] = '≥ ' + row[row.length - 1];
    }

    let current = Array.from(row);
    let lastChanged = false;
    for (let i = 0;i < row.length;i++) {
      if (table[0][i] == 'Day') continue;
      if (!lastChanged && (current[i] == last[i])) row[i] = '';
      else if (current[i] != last[i]) lastChanged = true;
    }

    for (let acc of accounts) {
      let v = acc.val[r];

      let vs;

      if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense) {
        v = -v
      }
      vs = print_format_money(v);
      vs = [print_color_money(v), vs.length];

      row.push(vs);
    }

    last = current;
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    table.push(row);
  }

  table.push([]);
  let avg = [];
  let rowL = table[table.length - 2].length;
  for (let i = 0;i < rowL;i++) {
    let j = i - (rowL - accounts.length);
    if (j < -1) {
      avg.push('');
    } else if (j == -1) {
      avg.push('Avg');
    } else {
      let acc = accounts[j];
      let v = Math.round(acc.sum.div(dateFunctions.length).toNumber() * 100) / 100 | 0;

      let vs;

      if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense) {
        v = -v
      }
      vs = print_format_money(v);
      vs = [print_color_money(v), vs.length];

      avg.push(vs);
    }
  }
  table.push(avg);


  console.log(`Reporting from ${c.bold(strF)} to ${c.bold(strT)}\n`);

  console.log(tabulate(table, {
    align: align
  }));
}
