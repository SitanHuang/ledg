async function cmd_balancesheetequity(args) {
  if (args.modifiers.from)
    args.flags.skip = args.modifiers.from;
  args.modifiers.from = args.modifiers.from || '@min';
  args.flags.cumulative = true;

  report_set_accounts(args);
  report_compile_account_regex();
  report_extract_tags(args);
  report_extract_account(args);

  args.accounts = args.accounts || [];

  let rep = new MultiPeriodAccReport({
    title: "Balance Sheet",
    subreports: [
      new MultiPeriodAccSubReport({
        title: "Assets",
        accounts: [cmd_report_accounts_compiled.asset, ...args.accounts],
        positive: true,
        plus: false,
        net: 1,
      }),
      new MultiPeriodAccSubReport({
        title: "Liabilities",
        accounts: [cmd_report_accounts_compiled.liability, ...args.accounts],
        invert: true,
        positive: false,
        plus: false,
        net: -1,
      }),
      new MultiPeriodAccSubReport({
        title: "Equity",
        accounts: [cmd_report_accounts_compiled.equity, ...args.accounts],
        invert: true,
        positive: false,
        plus: false,
        net: -1,
      }),
    ],
    plus: false,
    args: args
  });
  await rep.exec();
}
