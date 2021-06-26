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

    let neg = d2 > d1;

    let [y, m, d] = neg ? events_date_prec_diff(d2, d1, squash) :
                          events_date_prec_diff(d1, d2, squash);

    if (y && squash.indexOf('y') >= 0)
      row[4].push(y + ' years');
    if (m && squash.indexOf('m') >= 0)
      row[4].push(m + ' months');
    if (d && squash.indexOf('d') >= 0)
      row[4].push(d + ' days');

    !row[4].length && row[4].push('0 days');

    row[4] = (neg ? '-' : '') + row[4].join(' ');

    table.push(row);
  }

  tabulate_less(table);
}
