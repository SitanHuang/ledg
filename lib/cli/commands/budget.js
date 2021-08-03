
async function cmd_budget(args) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = 2;

  let budgetNames = Object.keys(data.budgets);

  if (args._.indexOf('edit') >= 0) {
    let path = fs_book_name + '.budgets.ledg';
    let EDITOR = process.env.EDITOR || 'vim';
    let args2 = EDITOR == 'vim' ? ['+autocmd BufRead,BufNewFile *.*.ledg setlocal ts=55 sw=55 expandtab! softtabstop=-1 nowrap listchars="tab:→\ ,nbsp:␣,trail:•,extends:⟩,precedes:⟨" list noautoindent nocindent nosmartindent indentexpr=', path] : [path];

    const ls = require('child_process').spawn(process.env.EDITOR || 'vim', args2, {
      cwd: fs_get_book_directory(),
      stdio: 'inherit'
    });
    return;
  } else if (args._.indexOf('list') >= 0) {
    let table = [['#', 'Budget']];
    let i = 0;
    for (let b of budgetNames) {
      table.push([++i, b]);
    }
    console.log('\n' + tabulate(table));
    return;
  }

  let mpart = args._.indexOf('partition') >= 0 || args._.indexOf('disk') >= 0;
  if (!budgetNames.length) {
    console.error(`Please create at least one budget at ${fs_book_name}.budgets.ledg`);
    return 1;
  }

  args.flags['skip-book-close'] = true;

  if (!args.flags.budget && budgetNames.length > 1) {
    let table = [['#', 'Budget']];
    let i = 0;
    for (let b of budgetNames) {
      table.push([++i, b]);
    }
    console.log('\n' + tabulate(table))
    process.stdout.write('Choose one: ');
    let ans = Math.max(Math.min(parseInt((await readline_prompt())) || 1, budgetNames.length), 0) - 1;
    console.log(`${ESC}[1AChoose one: ${c.green(budgetNames[ans])}`);
    args.flags.budget = budgetNames[ans];
  }
  let budget = data.budgets[typeof args.flags.budget == 'number' ?
                              budgetNames[args.flags.budget - 1] :
                              args.flags.budget?.toString() || budgetNames[0]];
  if (!budget) {
    console.error(`Specified budget "${args.flags.budget}" is not found.`);
    return 1;
  }

  if (args.flags['sum-parent'] === false) {
    args.flags['sum-parent'] = true;
    console.log("Warning: sum-parent is always enabled");
  }

  args.flags['max-depth'] = args.flags['max-depth'] || Infinity;
  let countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};

  args.modifiers.from = report_replaceDateStr(args.modifiers.from);
  args.modifiers.to = report_replaceDateStr(args.modifiers.to);
  // specified or budget dates
  let from = args.modifiers.from ? Math.floor(Date.parse(args.modifiers.from + 'T00:00:00') / 1000) : budget.from;
  let to = args.modifiers.to ? Math.floor(Date.parse(args.modifiers.to + 'T00:00:00') / 1000) : budget.to;

  // allow report_traverse to filter dates
  cmd_report_modifiers.from = args.modifiers.from = entry_datestr(from);
  cmd_report_modifiers.to = args.modifiers.to = entry_datestr(to);

  let period = to - from;
  let periodRemaining = Math.max(to - Math.max(from, Math.floor(new Date() / 1000)), 0);
  let periodPassed = Math.min(to, Math.floor(new Date() / 1000)) - from;
  if (new Date() / 1000 > to) {
    periodRemaining = period;
    periodPassed = 0;
  }
  let originalPeriod = budget.to - budget.from;
  let zoom = period / originalPeriod;
  let periodAltered = (from != budget.from) || (to != budget.to);
  if (periodAltered && !args.flags['do-not-adjust']) {
    console.log(`Due to custom time range, budget amounts had been adjusted by a factor of ${Math.round(zoom * 100) / 100}.`);
  }

  let title = [[('\n ' + c.bold(budget.description) +
  ` (${entry_datestr(budget.from)} to ${entry_datestr(budget.to)})` +
    (periodAltered ? ` => (${entry_datestr(from)} to ${entry_datestr(to)})` : '')
  )]];
  title[0].header = false
  title[0].htmlTitle = 'h3';

  process.stdout.write(tabulate(title));

  let table = [];

  function eta(a, b, x, reverse) {
//     let d = Math.max(b - a, b - x);
    let d = b - x; // remaining

    const DAY = 86400;
    const WEEK = 604800;
    const YEAR = DAY * 365;
    const MONTH = YEAR / 12;

    let avgPrd = [YEAR, 'yr', 'years'];

    if (period / 6 < WEEK || periodRemaining < WEEK) avgPrd = [DAY, 'd', 'days'];
    else if (period / 6 < MONTH || periodRemaining < MONTH) avgPrd = [WEEK, 'wk', 'weeks'];
    else if (period / 6 < YEAR || periodRemaining < YEAR) avgPrd = [MONTH, 'm', 'months'];

    let remainPrds = Math.round(periodRemaining / avgPrd[0] * 10) / 10;
    let prdsPsd = Math.round(periodPassed / avgPrd[0] * 10) / 10;

    let cRate = Math.round(x / prdsPsd * 100) / 100 || 0;
    let bRate = Math.round(d / remainPrds * 100) / 100 || 0;

    let perc = ((x / prdsPsd) - (d / remainPrds)) / (x / remainPrds);

    let color = c.yellowBright;
    if (Math.abs(perc) > 0.15)
      color = reverse ? (perc < 0 ? c.redBright : c.green) : (perc > 0 ? c.redBright : c.green);

    let et = d / (x / periodPassed) || 0;

    let etas = `${Math.ceil(et / DAY * 5) / 5} days`;
    if (et > YEAR) etas = `${Math.ceil(et / YEAR * 5) / 5} years`;
    else if (et > MONTH) etas = `${Math.ceil(et / MONTH * 5) / 5} months`;
    else if (et > WEEK) etas = `${Math.ceil(et / WEEK * 5) / 5} weeks`;

    if (et == Infinity) etas = '∞ years';
    if (et == -Infinity) etas = '-∞ years';

    let s = color(`${cRate == Infinity ? '∞' : cRate == -Infinity ? '-∞' : new Big(cRate).toNumber().toPrecision(4)}/${avgPrd[1]}`);
    return [[s, strip_ansi(s).length],
            `${bRate == Infinity ? '∞' : bRate == -Infinity ? '-∞' :  new Big(bRate).toNumber().toPrecision(4)}/${avgPrd[1]}`,
            etas
           ];
  }

  // ==============================================
  //                   trackers
  // ==============================================

  if (args.flags.simple)
    table.push(['Trackers', 'Budget', 'Used', 'Remain', 'Use%']);
  else
    table.push(['Trackers', '', 'Progress', '', 'Budget', 'Used', 'Remain', 'Use%', '  Rate', 'Rec  ', 'ETC  ']);
  for (let track of budget.trackers) {
    track = Object.assign({}, track);
    if (periodAltered && !args.flags['do-not-adjust']) {
      track.high = track.high.minus(track.low).timesPrim(zoom).plus(track.low);
    }

    let args2 = argsparser(parseArgSegmentsFromStr(track.q));
    report_extract_account(args2);
    report_extract_tags(args2);

    let total = new Money(0);

    let ignored = Object.keys(cmd_report_modifiers);

    let regexMod = {};
    for (mod in args2.modifiers) {
      if (ignored.indexOf(mod) >= 0) continue;
      if (args2.modifiers[mod]) regexMod[mod] = new RegExp(args2.modifiers[mod], 'i');
    }
    await data_iterate_books(data_books_required(from * 1000, to * 1000), async function (book) {
      let len = book.length;
      WHILE: while (len--) {
        if ((book[len].time >= from) && (book[len].time < to)) {
          // skip all bookClose by force
          if (book[len].bookClose && book[len].bookClose.toString() == 'true') continue;
          for (mod in regexMod) {
            if (!book[len][mod]) {
              if (regexMod[mod].source == '(?:)') continue; // empty on both
              else continue WHILE;
            }
            if (regexMod[mod].source == '(?:)') continue;
            if (book[len][mod] && !(book[len][mod].toString()).match(regexMod[mod])) continue WHILE;
          }
          for (let q of args2.accounts) {
            for (let t of book[len].transfers) {
              if (t[1].match(q)) {
                total = total.plus(t[2].tryConvertArgs(args, book[len].time));
              }
            }
          }
        }
      }
    });

    let remain = track.high.minus(total);
    let title = ' ' + track.q + '  ';

    let usePerc = Math.round(total.minus(track.low).div(track.high.minus(track.low)) * 100) + '%';
    let low = track.low.tryConvertArgs(args).noColorFormat(dp);
    let high = track.high.tryConvertArgs(args).noColorFormat(dp);

    if (args.flags.simple)
      table.push([
                  [c.yellowBright(title), title.length],
                  high,
                  total.tryConvertArgs(args).noColorFormat(dp),
                  remain.tryConvertArgs(args).noColorFormat(dp),
                  usePerc
                 ]);
    else
    table.push([
                [c.yellowBright(title), title.length],
                [c.cyan(low), low.length],
                [print_progress_bar(total.minus(track.low).div(track.high.minus(track.low)), { reverseLowHigh: track.type == 'goal' }), 50],
                [c.cyan(high), high.length],
                [c.yellowBright(track.type.toUpperCase()), track.type.length],
                total.tryConvertArgs(args).noColorFormat(dp),
                remain.tryConvertArgs(args).noColorFormat(dp),
                usePerc,
                ...eta(track.low.val(), track.high.val(), total.val(), track.type == 'goal')
               ]);
  }

  // ==============================================
  //                   budgets
  // ==============================================

  report_extract_account(args);
  report_extract_tags(args);


  let forkedBudgets = {};
  let disks = {};
  let baccs = Object.keys(budget.budgets).sort();
  // sum parent for budget
  baccs.forEach(x => {
    if (periodAltered && !args.flags['do-not-adjust']) {
      let high = budget.budgets[x];
      forkedBudgets[x] = forkedBudgets[x] || high.timesPrim(zoom);
    }
    forkedBudgets[x] = forkedBudgets[x] || budget.budgets[x];
    let levels = x.split(".");
    let previous = "";
    for (let l of levels) {
      let k = previous + l;
      if (k == x) continue;
      forkedBudgets[k] = (forkedBudgets[k] || new Money()).plus(forkedBudgets[x]);
      previous = k + ".";
    }
  });
  let balanceData = await report_sum_accounts(args, true, forkedBudgets);
  if (mpart) {
    baccs.forEach(x => {
      let levels = x.split(".");
      let previous = "";
      for (let l of levels) {
        let k = previous + l;
        if (k.indexOf('.') < 0) {
          disks[k] = disks[k] || mpart_dsk_create(forkedBudgets[k].tryConvertArgs(args).val());
          disks[k].label = k;
        } else
          disks[k] = disks[k] || mpart_partition_create(disks[previous.replace(/\.$/, '')], { fixed: forkedBudgets[k].tryConvertArgs(args).val(), label: l });
        previous = k + ".";
      }
    });
    console.log(JSON.stringify(mpart_disks));
    return;
  }

  table.push([]);
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];
  if (args.flags.simple) {
    align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];
    table.push(['Accounts', 'Total', 'Used', 'Remain', 'Use%']);
  } else {
    table.push(['Accounts', '', 'Progress', '', 'Budget', 'Used', 'Remain', 'Use%', '  Rate', 'Rec  ', 'ETC  ']);
  }
  table[table.length - 1].header = true;

  let accTree = print_accountTree(baccs);
  accTree.list.forEach((x, i) => {
    let fullX = accTree.fullList[i];
    if (countDots(fullX) > args.flags['max-depth']) return;

    let name = x.match(/^([^a-z0-9]+)([a-z0-9].+)$/i)
    let row = [[name[1] + c.yellowBright(name[2]), x.length]];
    table.push(row);

    //if (baccs.indexOf(fullX) < 0) return;

    let total = forkedBudgets[fullX];
    let used = balanceData[fullX];
    used.initCur = total.initCur;
    let remain = total.minus(used);
    let usePerc = Math.round(used.div(total).toNumber() * 100) + '%';
    let high = total.tryConvertArgs(args).noColorFormat(dp);
    let et = eta(0, total.val(), used.val());

    if (!args.flags.simple)
      row.push('', [print_progress_bar(used.div(total).toNumber()), 50]);
    if (!args.flags.simple)
      row.push([c.cyan(high), high.length]);
    else
      row.push(high);
    if (!args.flags.simple)
      row.push([c.yellowBright('LIMIT'), 5]);
    row.push(used.tryConvertArgs(args).noColorFormat(dp));
    row.push(remain.tryConvertArgs(args).noColorFormat(dp));
    row.push(usePerc);
    if (!args.flags.simple) {
      row.push(et[0], et[1], et[2]);
    }
  });

  /*
   "budgets": {
        "Expense": 300,
        "Expense.Other.Transportation": 300,
        "Expense.Essential.Groceries": 400,
        "Expense.Other.Education": 800,
        "Expense.Free.Retail.Tech": 1400
      },
      "*/
  tabulate_less(table, {
    align: align,
    colBorder: ' ',
    alternateColor: false
  });


}
