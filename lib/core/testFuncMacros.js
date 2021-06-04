const report_testFuncMacrosContext = {
  /*
   * the entry matching against
   * set by report_compile_test_func
   */
  _entry: null,

  // descriptions
  desc: (e) => {
    return report_testFuncMacrosContext._entry.description?.match(e);
  },
  transDesc: (...args) => {
    for (let t of report_testFuncMacrosContext._entry.transfers)
      for (let l of args)
        if (t[0].match(l))
          return true;
  },

  // money
  amount: (str) => {
    str = Money.parseMoney(str, report_testFuncMacrosContext._entry.time);
    for (let t of report_testFuncMacrosContext._entry.transfers)
      if (t[2].eq(str))
        return true;
  },
  gt: (str) => {
    str = Money.parseMoney(str, report_testFuncMacrosContext._entry.time);
    for (let t of report_testFuncMacrosContext._entry.transfers)
      if (t[2].gtr(str))
        return true;
  },
  lt: (str) => {
    str = Money.parseMoney(str, report_testFuncMacrosContext._entry.time);
    for (let t of report_testFuncMacrosContext._entry.transfers)
      if (t[2].lsr(str))
        return true;
  },

  // logic
  or: (...args) => {
    for (let x of args)
      if (x)
        return true;
  },
  and: (...args) => {
    for (let x of args)
      if (!x)
        return false;
    return true;
  },
  not: (x) => {
    return !x;
  },

  // tags
  tag: (...tags) => {
    let s = report_testFuncMacrosContext._entry.tags?.split(',') || [];
    let i = 0;
    for (let x of s)
      for (let z of tags)
        if (x == z.toUpperCase())
          i++;
    return i == tags.length;
  },

  // dates
  before: (iso) => {
    return report_testFuncMacrosContext._entry.time <
           Date.parse(iso + 'T00:00:00') / 1000;
  },
  on: (iso) => {
    return entry_datestr(report_testFuncMacrosContext._entry.time) == iso;
  },
  after: (iso) => {
    return report_testFuncMacrosContext._entry.time >
           Date.parse(iso + 'T00:00:00') / 1000;
  },

  // aux
  match: (x, e) => {
    return String(x).match(e);
  },
  /*
   * without this macro, testFunc has to do a `typeof` check as local variables
   * could be undefined
   */
  attr: (name, e) => {
    return e ? report_testFuncMacrosContext.match(report_testFuncMacrosContext._entry[name], e) :
               report_testFuncMacrosContext._entry[name];
  }
};
