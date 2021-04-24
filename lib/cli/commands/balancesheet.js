async function cmd_balancesheet(args) {
  if (args.modifiers.from)
    args.flags.skip = args.modifiers.from;
  args.modifiers.from = args.modifiers.from || '@min';
  args.flags.cumulative = true;

  report_set_accounts(args);
  report_compile_account_regex();

  args.accounts = args.accounts || [];

  let rep = new MultiPeriodAccReport({
    title: "Balance Sheet",
    subreports: [
      new MultiPeriodAccSubReport({
        title: "Assets",
        accounts: [cmd_report_accounts_compiled.asset, ...args.accounts],
        positive: true, // positive asset = green
        plus: false, // show plus sign
        net: 1,
      }),
      new MultiPeriodAccSubReport({
        title: "Liabilities",
        accounts: [cmd_report_accounts_compiled.liability, ...args.accounts],
        invert: true,
        positive: false, // positive liability = red
        plus: false, // show plus sign
        net: -1,
      }),
    ],
    plus: false, // plus sign in net
    args: args
  });
  await rep.exec();
}
