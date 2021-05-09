async function cmd_register(args) {
  args.modifiers.to = args.modifiers.to || '@tomorrow';

  let skipTo;
  args.flags['skip'] &&
     (skipTo = report_replaceDateStr(args.flags['skip'])) &&
     !isNaN(skipTo = Date.parse(skipTo + 'T00:00:00'));

  args.flags['hide-zero'] = args.flags['hide-zero'] !== false;
  args.flags['skip-book-close'] = args.flags['skip-book-close'] !== false;

  let depth = Number(args.flags['max-depth']) || Infinity;

  let sortFunc = args.flags.sort ?
                   (args.flags.sort == 'asc' ?
                     (a, b) => tabulate_sortByMoney_callback(a, b, true) :
                     (a, b) => tabulate_sortByMoney_callback(a, b, false)) :
                   undefined;

  // defaults from:@min, to:@max
  let q = { queries: [query_args_to_filter(args, ['entries'])] };
  let accs = q.queries[0].accounts;
  !accs.length && accs.push(fzy_compile('*'));

  let data = (await query_exec(q))[0].entries;
  data = report_sort_by_time(data);

  let int = report_get_reporting_interval(args, true);

  if (!int)
    _cmd_register_nogroup(args, data, skipTo, depth, sortFunc);
  else
    _cmd_register_group(args, data, skipTo, depth, int, q.queries[0], sortFunc);

}

function _cmd_register_group(args, data, skipTo, depth, int, q, sortFunc) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = Big.DP;

  let table = [['Start', 'Acc', 'Amnt', 'Tot']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

  let sum = new Money();

  let from = q.from * 1000;
  let to = q.to * 1000;

  let crntD = new Date(from);
  while (crntD < to) {
    let endDate = new Date(crntD);
    endDate.setFullYear(endDate.getFullYear() + int[0]);
    endDate.setMonth(endDate.getMonth() + int[1]);
    endDate.setDate(endDate.getDate() + int[2]);

    let accs = {};
    for (let i = 0;i < data.length;i++) {
      let e = data[i];
      if (e.time >= Math.floor(endDate / 1000) || e.time < Math.floor(crntD / 1000)) continue;
      for (let q of args.accounts) {
        for (let t of e.transfers) {
          if (t[1].match(q)) {
            let a = print_truncate_account(t[1], depth);
            accs[a] = (accs[a] || new Money()).plus(t[2].tryConvertArgs(args, e.time));
          }
        }
      }
    }

    let j = -1;
    for (let acc in accs) {
      j++;
      let amnt = accs[acc];
      let row = j == 0 || args.flags.format ?
            [ c.cyanBright(entry_datestr(crntD / 1000)) ] : [''];

      row.push(acc);

      let m = args.flags.invert ? amnt.timesPrim(-1) : amnt;
      sum = sum.plus(m);
      if (!skipTo || e.time * 1000 >= skipTo) {
        row.push(m.colorFormat(dp, true), sum.colorFormat(dp));
        table.push(row);
      }
      row.sortBy = m;
    }

    if (j == -1 && !args.flags['hide-zero']) {
      let row = [
        c.cyanBright(entry_datestr(crntD / 1000)),
        '', new Money().colorFormat(), sum.colorFormat(dp)
      ];
      row.sortBy = new Money();
      table.push(row);
    }

    crntD = endDate;
  }

  tabulate_less(table, { align: align, sortBody: sortFunc });
}

function _cmd_register_nogroup(args, data, skipTo, depth, sortFunc) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = Big.DP;

  let table = [['Date', 'UUID', 'Desc', 'Acc', 'Amnt', 'Tot']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

  let sum = new Money();

  for (let i = 0;i < data.length;i++) {
    let e = data[i];

    let j = 0;
    for (let q of args.accounts) {
      for (let t of e.transfers) {
        if (t[1].match(q)) {
          let row = j == 0 || args.flags.format ?
                      [ c.cyanBright(entry_datestr(e)), c.cyan(e.uuid) ] : ['', ''];

          let desc = t[0] || (j++ == 0 ? e.description : '');
          desc = args.flags['light-theme'] ? c.black(desc) : c.whiteBright(desc);
          if (e.virt)
            desc = c.underline(desc);
          if (e.pending)
            desc = c.bold.redBright('! ') + desc;
          row.push(desc, print_truncate_account(t[1], depth));

          let m = args.flags.invert ? t[2].timesPrim(-1) : t[2];
          m = m.tryConvertArgs(args, e.time);
          sum = sum.plus(m);
          if (skipTo && e.time * 1000 < skipTo)
            continue;
          row.push(m.colorFormat(dp, true), sum.colorFormat(dp));
          row.sortBy = m;
          table.push(row);
        }
      }
    }
  }

  tabulate_less(table, { align: align, sortBody: sortFunc });
}
