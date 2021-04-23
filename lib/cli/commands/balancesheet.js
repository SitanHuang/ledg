async function cmd_balancesheet(args) {
  args.flags.skip = args.flags.skip || args.modifiers.from;
  args.modifiers.from = args.modifiers.from || '@min';
  args.flags.cumulative = true;

  report_set_accounts(args);
  report_compile_account_regex();

  let rep = new MultiPeriodAccReport({
    title: "Balancesheet",
    subreports: [
      new MultiPeriodAccSubReport({
        title: "Assets",
        accounts: [cmd_report_accounts_compiled.asset]
      }),
      new MultiPeriodAccSubReport({
        title: "Liabilities",
        accounts: [cmd_report_accounts_compiled.liability]
      }),
    ],
    args: args
  });
  await rep.exec();
}
