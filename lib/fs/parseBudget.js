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
      
      let m = amnt.match(/(goal|limit) (-?\d+(\.\d*)?)-(-?\d+(\.\d*)?)/i);
      if (m) { // tracker
        entry.trackers.push({q: q, type: m[1], low: m[2], high: m[4]});
      } else if (!isNaN(m = Number(amnt))) { // traditional budget
        entry.budgets[q] = entry.budgets[q] || 0;
        entry.budgets[q] = new Big(entry.budgets[q]).plus(m).toNumber();
      }
      
    }
  }
  return entry;
}
