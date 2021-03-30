async function cmd_register(args) {
  args.modifiers.to = args.modifiers.to || '@tomorrow';

  let skipTo;
  args.flags['skip'] &&
     (skipTo = report_replaceDateStr(args.flags['skip'])) &&
     !isNaN(skipTo = Date.parse(skipTo + 'T00:00:00'));

  args.flags['hide-zero'] = args.flags['hide-zero'] !== false;

  let depth = Number(args.flags['max-depth']) || Infinity;

  // defaults from:@min, to:@max
  let q = { queries: [query_args_to_filter(args, ['entries'])] };
  q.queries[0].collect = ['entries'];

  let data = (await query_exec(q))[0].entries;
  data = report_sort_by_time(data);

  let int = report_get_reporting_interval(args, true);

  if (!int)
    _cmd_register_nogroup(args, data, skipTo, depth);
  else
    _cmd_register_group(args, data, skipTo, depth, int, q.queries[0]);

}

function _cmd_register_group(args, data, skipTo, depth, int, q) {
  let table = [['Start', 'Acc', 'Amnt', 'Tot']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

  let sum = new Big(0);

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
      if (e.time >= endDate / 1000 | 0 || e.time < crntD / 1000 | 0) continue;
      for (let q of args.accounts) {
        for (let t of e.transfers) {
          if (t[1].match(q)) {
            let a = print_truncate_account(t[1], depth);
            accs[a] = (accs[a] || new Big(0)).add(t[2]);
          }
        }
      }
    }
    
    let j = -1;
    for (let acc in accs) {
      j++;
      let amnt = accs[acc];
      let row = j == 0 || args.flags.csv ?
            [ c.cyanBright(entry_datestr(crntD / 1000)) ] : [''];

      row.push(acc);

      let m = args.flags.invert ? -amnt : amnt;
      sum = sum.add(m);
      if (!skipTo || e.time * 1000 >= skipTo) {
        row.push(print_color_money(m, true), print_color_money(sum));
        table.push(row);
      }
    }

    if (j == -1 && !args.flags['hide-zero']) {
      table.push([
        c.cyanBright(entry_datestr(crntD / 1000)),
        '', print_format_money(0), print_color_money(sum)
      ]);
    }

    crntD = endDate;
  }

  console.log(tabulate(table, { align: align }));
}

function _cmd_register_nogroup(args, data, skipTo, depth) {
  let table = [['Date', 'UUID', 'Desc', 'Acc', 'Amnt', 'Tot']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

  let sum = new Big(0);

  for (let i = 0;i < data.length;i++) {
    let e = data[i];

    let j = 0;
    for (let q of args.accounts) {
      for (let t of e.transfers) {
        if (t[1].match(q)) {
          let row = j == 0 || args.flags.csv ?
                      [ c.cyanBright(entry_datestr(e)), c.cyan(e.uuid) ] : ['', ''];

          let desc = t[0] || (j++ == 0 ? e.description : '');
          desc = args.flags['light-theme'] ? c.black(desc) : c.whiteBright(desc);
          row.push(desc, print_truncate_account(t[1], depth));

          let m = args.flags.invert ? -t[2] : t[2];
          sum = sum.add(m);
          if (skipTo && e.time * 1000 < skipTo)
            continue;
          row.push(print_color_money(m, true), print_color_money(sum));
          table.push(row);
        }
      }
    }
  }

  console.log(tabulate(table, { align: align }));
}
