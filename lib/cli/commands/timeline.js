async function cmd_timeline(args) {
  args.modifiers.from = args.modifiers.from || '@month-start';
  args.modifiers.to = args.modifiers.to || '@tomorrow';

  let strF = report_replaceDateStr(args.modifiers.from);
  let strT = report_replaceDateStr(args.modifiers.to);
  let from = Date.parse(strF + 'T00:00:00');
  let to = Date.parse(strT + 'T00:00:00');

  let query = { queries: [] };
  let days = [];

  let crntD = new Date(from);
  while (crntD < to) {
    // start of day rather than end
    let day = [];
    day.date = new Date(crntD);
    days.push(day);

    let a = Math.floor(crntD.getTime() / 1000);
    crntD.setDate(crntD.getDate() + 1);
    let b = Math.floor(Math.min(crntD.getTime(), to) / 1000);

    let q = query_args_to_filter(args);
    q.from = a;
    q.to = b;
    q.flags['skip-book-close'] = true;
    q.modifiers.clockOut = '.+';
    q.collect = ['entries'];
    query.queries.push(q);
  }

  let dep = Math.max(isNaN(args.flags['max-depth']) ? Infinity : args.flags['max-depth'], 0);

  let data = (await query_exec(query));

  for (let i = 0;i < data.length;i++) {
    let entries = data[i].entries;
    let day = days[i];
    for (let entry of entries) {
      for (let t of entry.transfers) {
        // acc is used as a uniq seed for generating colors
        // truncates to depth:
        let acc = t[1].split('.').slice(0, dep).join('.');
        let desc = t[0];
        let m = t[2];
        let start = entry.time - (m.amnts['s'] ? m.amnts['s'].toNumber() : 0)
                               - (m.amnts['m'] ? m.amnts['m'].toNumber() : 0) * 60
                               - (m.amnts['h'] ? m.amnts['h'].toNumber() : 0) * 60 * 60
                               - (m.amnts['d'] ? m.amnts['d'].toNumber() : 0) * 60 * 60 * 24;
        // skip the balancing transfer
        if (start >= entry.time)
          continue;

        let seed = 0;
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0, ch; i < acc.length; i++) {
            ch = acc.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
        h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
        let hash = 4294967296 * (2097151 & h2) + (h1>>>0);

        day.push({
          from: start,
          to: entry.time,
          desc: desc,
          rgb: randomColor({
            luminosity: 'dark',
            seed: hash,
            format: 'rgbArray'
          })
        });
      }
    }
  }

  let chart = new Timechart(days);
  if (!isNaN(args.flags.minhour))
    chart.minHour = Math.max(Math.min(args.flags.minhour, 24), 0);
  if (!isNaN(args.flags.maxhour))
    chart.maxHour = Math.min(Math.max(args.flags.maxhour, 0), 24);
  chart.paint()
  console.log(chart.render());
}
