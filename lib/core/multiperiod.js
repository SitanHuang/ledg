class MultiPeriodAccReport {
  /*
   * {
   *  title: string,
   *  subreports: [ MultiPeriodAccSubReport, ...],
   *  args: {
   *    flags: {
   *      cumulative: boolean,
   *      skip: date,
   *      hide-zero: (true),
   *      skip-book-close: (true),
   *      sort: boolean,
   *    },
   *    modifiers: {
   *      from: date,
   *      to: date,
   *    },
   *    accounts: [ RegExp, ...]
   *  }
   * }
   */
  constructor(opts) {
    this.opts = opts;

    this.title = opts.title;
    this.subreports = opts.subreports;
    this.args = opts.args;

    this.cumulative = this.args.flags.cumulative;

    this.processArgs();
    this.populatePeriods();

    this.tree = new AccountTreeView(true, this.periods.length);
  }

  processArgs() {
    let args = this.args;

    args.flags['skip-book-close'] = args.flags['skip-book-close'] !== false;
    args.flags['hide-zero'] = args.flags['hide-zero'] !== false;
    args.flags.iso = args.flags.iso !== false;
    args.flags.dp = isNaN(args.flags.dp) ?
                      (args.flags.percent ? 1 : 2) :
                      args.flags.dp;

    this.depth = args.flags['max-depth'] || Infinity;
    this.int = report_get_reporting_interval(args);

    MultiPeriodAccReport.setDefaultRangeFromInterval(this.int);
    if (this.cumulative)
      args.flags.skip = args.flags.skip || cmd_report_modifiers.from;

    report_set_modifiers(args);
    report_set_accounts(args);
    report_compile_account_regex();
    report_extract_tags(args);

    args.modifiers.from = args.modifiers.from || cmd_report_modifiers.from;
    args.modifiers.to = args.modifiers.to || cmd_report_modifiers.to;

    this.eop = args.flags['valuation-eop'];
    if (this.eop)
      delete args.flags['valuation-date'];

    args.flags.skip &&
       (this.skip = report_replaceDateStr(args.flags.skip)) &&
       (this.skip = Date.parse(this.skip + 'T00:00:00'));

    if (isNaN(this.skip))
      delete this.skip;

    let strF = report_replaceDateStr(args.modifiers.from);
    let strT = report_replaceDateStr(args.modifiers.to);
    this.from = Date.parse(strF + 'T00:00:00');
    this.to = Date.parse(strT + 'T00:00:00');

    this.periodsStart = this.skip || this.from;
    this.periodsEnd = this.to;

    if (this.periodsStart >= this.periodsEnd)
      throw "Period start cannot be later or equal to period end.";
  }

  static setDefaultRangeFromInterval(int) {
    let showDays = true;
    let showMonth = true;
    let showWeeks = int[2] >= 7 && int[2] % 7 == 0;
    let showQuarter = int[1] >= 3 && int[1] % 3 == 0;

    if (int[2] > 0 && int[2] < 7) {
      cmd_report_modifiers.from = '@month-start';
      cmd_report_modifiers.to = '@tomorrow';
    } else if (showWeeks || int[1] == 1) {
      cmd_report_modifiers.from = '@year-start';
      cmd_report_modifiers.to = '@month-end';
    } else if (int[0] >= 1) {
      cmd_report_modifiers.from = '@min';
      cmd_report_modifiers.to = '@max';
    } else {
      cmd_report_modifiers.from = '@last-year';
      cmd_report_modifiers.to = '@month-end';
    }
  }

  populatePeriods() {
    this.periods = [];

    let args = this.args;

    let from = this.periodsStart;
    let to = this.periodsEnd;

    let crntD = new Date(from);
    while (crntD < to) {
      let a = Math.floor(crntD.getTime() / 1000);
      crntD.setFullYear(crntD.getFullYear() + this.int[0]);
      crntD.setMonth(crntD.getMonth() + this.int[1]);
      crntD.setDate(crntD.getDate() + this.int[2]);
      let b = Math.floor(Math.min(crntD.getTime(), to) / 1000);

      this.periods.push({ from: a, to: b });
    }

    if (this.skip && this.cumulative)
      this.historicalRange = {
        from: Math.floor(Date.parse(report_replaceDateStr('@min') + 'T00:00:00') / 1000),
        to: Math.floor(this.skip / 1000),
      };
  }

  async exec() {
    await this.query();
    this.makeTable();
  }

  async query() {
    let queries = { queries: [] };

    for (let sub of this.subreports) {
      if (this.historicalRange) {
        let his = sub.buildQuery(this.args);
        Object.assign(his, this.historicalRange);
        queries.queries.push(his);
      }

      for (let p of this.periods) {
        let his = sub.buildQuery(this.args);
        Object.assign(his, p);
        queries.queries.push(his);
      }
    }

    if (this.eop)
      for (let q of queries.queries)
        delete q.flags.currency;

    this.data = await query_exec(queries);
    /*console.debug(JSON.stringify(this.data.map(x => {
      x.from = entry_datestr(x.from);
      x.to = entry_datestr(x.to);
      return x;
    }), null, 2));*/
    this.populateTree();
  }

  populateTree() {
    let _data = this.data;
    let offset = 0;
    for (let i = 0;i < this.subreports.length;i++) {
      let sub = this.subreports[i];
      if (this.historicalRange)
        this.tree.putHistoricalSums(_data[offset++].accounts_sum);

      this.tree.putAccSumsArr(_data
                                .slice(offset, offset + this.periods.length)
                                .map(x => x.accounts_sum));

      offset += this.periods.length;
    }

    if (!this.args.flags['hide-zero'])
      for (let acc in data.accounts)
        this.tree.putAcc(acc);

    if (this.cumulative)
      this.tree.recursiveCumulate();

    this.tree.sumForDepth(this.depth, this.args.flags['sum-parent']);

    if (this.args.flags['hide-zero'])
      this.tree.recursiveRemoveEmpty();
  }

  makeTable() {
    let table = [ this.makePeriods() ];

    let net = this.makeSumRow();
    for (let sub of this.subreports) {
      table.push(...sub.makeTable(this));
      net = net.map((x, i) => x.plus(sub.sums[i].timesPrim(sub.opts.net || 1)));
    }

    /*
    let spacer = this.makeRow();
    spacer.resetAlternateColor = true;
    spacer.header = true;
    table.push(spacer);
    */

    let that = this;
    net = [
      '  Net',
      ...(net.map(x => new TabularHTMLNumberCell(that.formatMoney(x))))
    ];
    net.htmlTitle = 'strong';
    table.push(net);

    console.log(tabulate([ this.makeTitle() ]));
    console.log(tabulate(table, {
      align: this.makeRow().map((x, i) => i > 0 ?
                                            TAB_ALIGN_RIGHT :
                                            TAB_ALIGN_LEFT)
    }));
  }

  makeTitle() {
    let r = this.makeRow();
    r.header = false;
    r.htmlTitle = 'h3';
    r[0] = c.bold(this.title) + ` ${entry_datestr(this.periodsStart / 1000)} ->`
                      + ` ${entry_datestr(this.periodsEnd / 1000)}`;
    return r;
  }

  makePeriods() {
    let r = this.makeRow();
    r.header = true;
    for (let i = 0;i < this.periods.length;i++) {
      r[i + 1] = entry_datestr(this.periods[i].to);
      if (!this.args.flags.isofull && this.args.flags.iso) {
        let from = new Date(this.periods[i].from * 1000);
        let to = new Date(this.periods[i].to * 1000);
        let date = r[i + 1];
        if (from.getFullYear() == to.getFullYear()) {
          date = date.substr(5);
          if (from.getMonth() == to.getMonth())
            date = date.substr(3);
        }
        r[i + 1] = date.replace(/-01$/, '');
      }
    }
    if (this.args.flags.avg)
      r[r.length - 1] = 'Avg';
    return r;
  }

  makeRow() {
    return Array(this.periods.length + 1 + (this.args.flags.avg ? 1 : 0))
             .fill(' ');
  }

  makeSumRow() {
    return Array(this.periods.length + (this.args.flags.avg ? 1 : 0))
             .fill(1).map(() => new Money());
  }

  formatMoney(x) {
    let dp = Math.max(this.args.flags.dp, 0);
    let plus = this.opts.plus;
    return x.colorFormat(dp, plus);
  }
}

class MultiPeriodAccSubReport {
  constructor(opts) {
    this.opts = opts;

    this.title = opts.title;
    this.accounts = opts.accounts;

    this.invert = opts.invert;
    this.positive = opts.positive;
    this.plus = opts.plus;

    this.sums = [];
  }

  matchAcc(s) {
    return s.match(this.accounts[0]);
  }

  buildQuery(args) {
    let q = query_args_to_filter(args, ['accounts_sum']);
    q.accounts = this.accounts;
    q.accSumMatchTransfer = true;
    q.invert = this.invert;
    return q;
  }

  makeTable(parent) {
    let rows = [ this.makeTitle(parent) ];
    let tree = parent.args.flags.tree;

    this.populateSumsTable(parent);

    for (let i = 0;i < this.sumsTable.length;i++) {
      let srow = this.sumsTable[i];

      let row = parent.makeRow();
      row[0] = tree ?
                 Array(srow.tree.depth * 2 - 1).fill(' ').join("")
                   + srow.tree.name :
                 srow.tree.fullName;

      for (let j = 0;j < srow.length;j++) {
        if (parent.args.flags.percent)
          row[j + 1] = this.formatPercent(parent, srow[j], this.sums[j]);
        else
          row[j + 1] = this.formatMoney(parent, srow[j]);

        row[j + 1] = new TabularHTMLNumberCell(row[j + 1]);
      }

      row.underline = i == this.sumsTable.length - 1;
      rows.push(row);
    }


    let sumRow = [''].concat(this.sums.map(x =>
      // parent.args.flags.percent ?
      //   this.formatPercent(parent, x, x) :
        new TabularHTMLNumberCell(this.formatMoney(parent, x))
    ));
    sumRow.resetAlternateColor = true;
    sumRow.underline = true;
    rows.push(sumRow);

    return rows;
  }

  formatPercent(parent, x, sum) {
    x = x.removeEmpty();
    sum = sum.removeEmpty();
    if (x.isZero() || sum.isZero())
      return this.formatMoney(parent, new Money());
    // numbers should already be converted
    // just check if containing one currency
    let curs = Object.keys(x.amnts);
    let curs2 = Object.keys(sum.amnts);
    if (Math.max(curs.length, curs2.length) != 1)
      throw 'While trying to produce percentages, some amounts cannot be ' +
            'squashed to one currency.\n' +
            'Did you use --currency ?';
    let perc = x.amnts[curs] / sum.amnts[curs2] * 100;
    let dp = Math.max(parent.args.flags.dp, 0);

    return new Money(perc, '').colorFormat(dp, false, this.positive) + ' %';
  }

  formatMoney(parent, x) {
    let dp = Math.max(parent.args.flags.dp, 0);
    let plus = this.plus;
    return x.colorFormat(dp, plus, this.positive);
  }

  transform(x) {
    if (this.invert)
      x = x.timesPrim(-1);
    return x;
  }

  populateSumsTable(parent) {
    this.sums = parent.makeSumRow();

    this.sumsTable = [];

    let topTrees = this.sortTrees(parent.args, this.findTopLevelTrees(parent));
    this.putTreesToSumsTable(parent, topTrees);
    if (parent.args.flags.avg)
      this.calcAverage(parent);
    if (parent.args.flags.sort && !parent.args.flags.tree)
    this.resortWihoutTree(parent);
  }

  calcAverage(parent) {
    let tab = this.sumsTable;
    let cur = parent.args.flags.currency || data.defaultCurrency;
    for (let row of tab) {
      let total = new Money();
      total.amnts[cur] = Big.ZERO;
      for (let col of row)
        total = total.plus(col);
      let avg = total.amnts[cur]
                    .toNumber() / row.length;
      row.push(new Money(avg));
    }
    let row = this.sums;
    let total = new Money();
    for (let col of row)
      total = total.plus(col);
    let avg = total.amnts[parent.args.flags.currency || data.defaultCurrency]
                  .toNumber() / row.length;
    row.push(new Money(avg));
  }

  resortWihoutTree(parent) {
    this.sumsTable = this.sumsTable.sort((a, b) => {
      return b.tree.totalSum.compare(a.tree.totalSum);
    });
  }

  putTreesToSumsTable(parent, trees) {
    let hz = parent.args.flags['hide-zero'];
    let treeMode = parent.args.flags.tree;
    let tab = this.sumsTable;
    for (let i = 0;i < trees.length;i++) {
      let tree = trees[i];
      let row = tree.dsum.map((x, i) => parent.args.avg ?
                                    x.convert(parent.args.flags.currency ||
                                              data.defaultCurrency,
                                              parent.periods[i].to - 1) :
                                    parent.eop ?
                                      x.convert(parent.args.flags.currency ||
                                        data.defaultCurrency,
                                        parent.periods[i].to - 1
                                      ) : x);
      let children = this.sortTrees(parent.args, Object.values(tree.children));

      if ((parent.args.flags['sum-parent'] && tree.depth == 1) ||
          !parent.args.flags['sum-parent']) {
        let _sums = this.sums;
        this.sums = row.map((x, _i) => x.plus(_sums[_i]));
      }

      row.tree = tree;

      let empty = !row.filter(x => !x.isZero()).length;
      let _i = tab.length - 1;
      if (!(empty && hz && !treeMode))
        tab.push(row);

      this.putTreesToSumsTable(parent, children);
    }
  }

  findTopLevelTrees(parent) {
    return Object.values(parent.tree.children)
             .filter(x => this.matchAcc(x.fullName));
  }

  sortTrees(args, trees) {
    let that = this;
    if (args.flags.tree)
      return trees.sort((a, b) =>
        (args.flags.sort && b.totalSum.compare(a.totalSum)) ||
        a.name.localeCompare(b.name)
      );
    return trees;
  }

  makeTitle(parent) {
    let r = parent.makeRow();
    r.header = true;
    r.htmlTitle = 'h4';
    r.resetAlternateColor = true;
    r[0] = this.title;
    return r;
  }
}
