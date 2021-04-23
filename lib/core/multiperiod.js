class MultiPeriodAccReport {
  /*
   * {
   *  title: string,
   *  subreports: [ MultiPeriodAccSubReport, ...],
   *  args: {
   *    flags: {
   *      cumulative: boolean,
   *      skip: date,
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

    // default: skip book close
    args.flags['skip-book-close'] = args.flags['skip-book-close'] !== false;


    this.int = report_get_reporting_interval(args);

    MultiPeriodAccReport.setDefaultRangeFromInterval(this.int);

    report_set_modifiers(args);
    report_set_accounts(args);
    report_compile_account_regex();
    report_extract_tags(args);

    args.modifiers.from = args.modifiers.from || cmd_report_modifiers.from;
    args.modifiers.to = args.modifiers.to || cmd_report_modifiers.to;

    this.eop = args.flags['valuation-eop'];

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
  }

  static setDefaultRangeFromInterval(int) {
    let showDays = true;
    let showMonth = true;
    let showWeeks = int[2] >= 7 && int[2] % 7 == 0;
    let showQuarter = int[1] >= 3 && int[1] % 3 == 0;

    if (int[2] > 0 && int[2] < 7) {
      cmd_report_modifiers.from = '@month-start';
      cmd_report_modifiers.to = '@tomorrow';
    } else if (showWeeks) {
      cmd_report_modifiers.from = '@year-start';
      cmd_report_modifiers.to = '@month-end';
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
      let a = crntD.getTime() / 1000 | 0;
      crntD.setFullYear(crntD.getFullYear() + this.int[0]);
      crntD.setMonth(crntD.getMonth() + this.int[1]);
      crntD.setDate(crntD.getDate() + this.int[2]);
      let b = Math.min(crntD.getTime(), to) / 1000 | 0;

      this.periods.push({ from: a, to: b });
    }

    if (this.skip && this.cumulative)
      this.historicalRange = {
        from: Date.parse(report_replaceDateStr('@min') + 'T00:00:00') / 1000 | 0,
        to: this.skip / 1000 | 0,
      };
  }

  async exec() {
    await this.query();
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

    this.data = await query_exec(queries);
  }
}

class MultiPeriodAccSubReport {
  constructor(opts) {
    this.opts = opts;

    this.title = opts.title;
    this.accounts = opts.accounts;
  }

  buildQuery(args) {
    let q = query_args_to_filter(args, ['accounts_sum']);
    q.accounts = this.accounts;
    return q;
  }
}
