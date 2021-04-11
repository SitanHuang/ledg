function fs_read_budgets_from_string(str) {
  let lines = str.replace(/\r/g, "").split("\n");
  let budgets = {};

  let entry = null;
  const commitEntry = (entry) => {
    budgets[entry.description] = entry;
  };

  for (let line of lines) {
    entry = fs_read_budget_proc_line(entry, line, commitEntry, Object.keys(budgets).length);
  }
  if (entry) { commitEntry(entry) }

  return budgets;
}

function fs_read_budget_proc_line(entry, line, commitEntry, entriesLength) {
  if (line[0] == ';') return entry;
  if (line[0] == '~') { // start entry
    if (entry) { commitEntry(entry) } // commit previous

    entry = {
      description: 'Unnamed budget ' + entriesLength,
      budgets: {},
      trackers: [],
      from: '@min',
      to: '@max'
    };
    entry.description = line.substring(1).trim() || entry.description;
  } else if (line.indexOf('  ;') === 0) { // entry meta data
    let colonIndex = line.indexOf(':');
    if (colonIndex < 0) { colonIndex = line.length; line += ':""'; }
    let key = line.substring(3, colonIndex);
    entry[key] = JSON.parse(line.substring(colonIndex + 1));

    if (key == 'from' || key == 'to') {
      entry[key] = Math.floor(Date.parse(report_replaceDateStr(entry[key]) + 'T00:00:00') / 1000);
    }
  } else if (line.indexOf('  ') === 0) { // budgets
    let splits = line.substring(2).split('\t');
    if (splits.length == 2) {
      let q = splits[0].trim();
      let amnt = splits[1].trim();
      let parsed;
      try {
        parsed = Money.parseMoney(amnt);
      } catch (e) {}

      let tReg = new RegExp(`(goal|limit) 0 *- *(${MON_REGEX.source})`, 'i');
      let tReg2 = new RegExp(`(goal|limit) (${MON_REGEX.source}) *- *0`, 'i');
      let m = amnt.match(tReg);
      if (m) {
        let a2 = Money.parseMoney(m[2]);
        entry.trackers.push({q: q, type: m[1], low: new Money(0, a2.initCur), high: a2});
      } else if (m = amnt.match(tReg2)) {
        let a2 = Money.parseMoney(m[2]);
        entry.trackers.push({q: q, type: m[1], low: a2, high: new Money(0, a2.initCur)});
      } else if (parsed) { // traditional budget
        entry.budgets[q] = entry.budgets[q] || new Money();
        entry.budgets[q] = entry.budgets[q].plus(parsed);
      }
    } else if (!fs_ignores_list["unknown-budget-directive"]) {
      throw new ParseError(`"${line}": unknown budget directive`);
    }
  } else if (line.trim().length && !fs_ignores_list["unknown-budget-directive"]) {
    throw new ParseError(`"${line}": unknown budget directive`);
  }

  return entry;
}
