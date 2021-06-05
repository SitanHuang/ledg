async function cmd_events(args) {
  args.modifiers.event = args.modifiers.event || '.';

  let squash = (args.flags.squash || 'ymd').toString();
  if (!squash.match(/^[ymd]+$/)) {
    console.error('--squash can only contain letters including y m d');
    return 1;
  }

  let events = report_sort_by_time((await query_args_exec(args, ['entries']))[0].entries);
  let table = [['Date', 'UUID', 'Type', 'Description', 'Since']];

  let d1 = new Date(Date.parse(report_replaceDateStr(args.flags.today || '@today') + 'T00:00:00'));

  for (let e of events) {
    let row = [
      c.cyanBright(entry_datestr(e)),
      c.cyan(e.uuid),
      c.yellowBright(e.event),
      e.description + (e.transfers.length ? ' [' + e.transfers.length + ']' : ''),
      []
    ];
    let d2 = new Date(e.time * 1000);
    let y = d1.getFullYear() - d2.getFullYear();
    let m = d1.getMonth() - d2.getMonth();
    let d = d1.getDate() - d2.getDate();

    // === precise diff ===
    if (d < 0) {
      let daysLastMonth = new Date(d1.getFullYear(), d1.getMonth(), 0).getDate();
      if (daysLastMonth < d2.getDate())
        d += d2.getDate();
      else
        d = daysLastMonth + d;
      m--;
    }
    if (m < 0) {
      m = 12 + m;
      y--;
    }

    // yd -> take out year, rest in days
    // md -> year to day
    if (squash.indexOf('y') == -1) {
      if (squash.indexOf('m') >= 0) // md
        m += y * 12;
      else // d
        d = Math.floor((d1 - d2) / (24 * 60 * 60 * 1000));
    } else if (squash.indexOf('m') == -1) { // yd
      let _d2 = new Date(d2);
      _d2.setFullYear(_d2.getFullYear() + y);
      d = Math.floor((d1 - _d2) / (24 * 60 * 60 * 1000));
    }

    if (y && squash.indexOf('y') >= 0)
      row[4].push(y + ' years');
    if (m && squash.indexOf('m') >= 0)
      row[4].push(m + ' months');
    if (d && squash.indexOf('d') >= 0)
      row[4].push(d + ' days');

    !row[4].length && row[4].push('0 days');

    row[4] = row[4].join(' ');

    table.push(row);
  }

  tabulate_less(table);
}
