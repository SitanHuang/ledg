
async function cmd_burndown(args) {
  console.clear();
  if (process.stdout.columns <= 10 || process.stdout.rows <= 15) {
    console.error('Terminal too small.');
    return 1;
  }
  if (args.flags['skip-book-close'] !== false)
    args.flags['skip-book-close'] = true;

  if (args.flags.abs !== false)
    args.flags.abs = true;

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
  args.modifiers.from = cmd_report_modifiers.from;
  args.modifiers.to = cmd_report_modifiers.to;

  let strF = report_replaceDateStr(args.modifiers.from);
  let strT = report_replaceDateStr(args.modifiers.to);
  let from = Date.parse(strF + 'T00:00:00');
  let to = Date.parse(strT + 'T00:00:00');

  let legends = [];

  let argQueries = Object.keys(args.flags).sort().filter(x => x.match(/q\d+/)).map(x => {
    let v = args.flags[x];
    if (typeof v !== 'string' || !v.length) {
      console.error(`Warning: skipped ${x}, invalid query`);
      return null;
    }
    legends.push(v);
    let args2 = argsparser(parseArgSegmentsFromStr(v));
    args2.flags.currency = args2.flags.currency || args.flags.currency;
    args2.flags['valuation-value'] = args2.flags['valuation-value'] || args.flags['valuation-value'];
    return args2;
  }).filter(x => !!x);
  if (!argQueries.length) {
    argQueries = [argsparser(parseArgSegmentsFromStr(cmd_report_accounts.income)),
                  argsparser(parseArgSegmentsFromStr(cmd_report_accounts.expense))];
    legends = [cmd_report_accounts.income, cmd_report_accounts.expense];
  }
  let maxIntervals = (process.stdout.columns - 8) / (argQueries.length * 2 + 1) | 0;
  let query = { cumulative: args.flags.cumulative && argQueries.length, from: from / 1000 | 0, to: to / 1000 | 0, queries: [] };
  let collect = args.flags.count ? ['count'] : ['sum'];

  let crntD = new Date(from);
  let intervals = 0;
  while (crntD < to) {
    let a = crntD.getTime() / 1000 | 0;
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    let b = Math.min(crntD.getTime(), to) / 1000 | 0;

    for (let i = 0;i < argQueries.length;i++) {
      let q = query_args_to_filter(argQueries[i]);
      q.from = a;
      q.flags['skip-book-close'] = true;
      q.to = b;
      q.collect = collect;
      query.queries.push(q);
    }

    intervals++;
  }
  if (intervals > maxIntervals) {
    console.error(`Terminal is too small for ${intervals} intervals, max ${maxIntervals}.`);
    return 1;
  }
  let data = await query_exec(query);
  let min = 0;
  let max = 0;
  let _d = [];
  for (let i = 0;i < data.length;i += argQueries.length) {
    let row = [];
    for (let j = 0;j < argQueries.length;j++) {
      row[j] = data[i + j][args.flags.count ? 'count' : 'sum'];
      if (!args.flags.count)
        row[j] = row[j].val(args.flags.currency || data.defaultCurrency);
      if (args.flags.abs) row[j] = Math.abs(row[j]);
      min = Math.min(min, row[j]);
      max = Math.max(max, row[j]);
    }
    _d.push(row);
  }

  let chart = new Chart(min, max, _d);

  let daysToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);
  let weeksToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);
  let monthsToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);
  let yearsToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);

  let drawWeeks = showWeeks;
  let drawDays = int[2] > 0;
  let drawMonths = false;
  let drawYears = false;

  crntD = new Date(from);
  let i = -1;
  let lastM = -1;
  let lastY = -1;
  while (crntD < to) {
    i++;
    let row = [crntD.getFullYear().toString()];
    if (showQuarter) row.push(print_full_quarter(crntD.getMonth()));

    let d = crntD.getDate();
    daysToDraw[i] = d.toString().padStart(2, '0');
    weeksToDraw[i] = pring_week(crntD).toString().padStart(2, '0');

    if ((d == 1) || (lastM != -1 && lastM != crntD.getMonth())) {
      drawMonths = true;
      monthsToDraw[i] = (int[1] > 0 || int[2] >= 14) ?
        (crntD.getMonth() + 1).toString().padStart(2, '0') : print_full_month(crntD.getMonth());
      lastM = crntD.getMonth();
    }
    if ((crntD.getMonth() == 0 && d == 1) || (lastY != -1 && lastY != crntD.getFullYear())) {
      drawYears = true;
      yearsToDraw[i] = int[0] ? (crntD.getYear() - 100).toString() : crntD.getFullYear().toString();
      lastY = crntD.getFullYear();
    }
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
  }

  let r = -1;
  if (drawDays) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    chart.replace(chart.gh + 2 + r, 0, ' Day');
    daysToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }
  if (drawWeeks) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    chart.replace(chart.gh + 2 + r, 0, ' Week');
    weeksToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }
  if (drawMonths) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    chart.replace(chart.gh + 2 + r, 0, 'Month');
    monthsToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }
  if (drawYears) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    yearsToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }

  console.log(chart.render() + '\n');
  let table = [[]];
  legends.forEach((x, i) => {
    let str = `      ${chart.colors[i]('  ')} ${x}`;
    table[0].push([str, strip_ansi(str).length]);
  });
  table[0].header = false;
  console.log(tabulate(table));
}
