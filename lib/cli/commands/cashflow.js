async function cmd_cashflow(args) {
  report_set_accounts(args);
  report_compile_account_regex();
  report_extract_tags(args);
  report_extract_account(args);

  args.accounts = args.accounts || [];

  let rep = new MultiPeriodAccReport({
    title: "Cashflow Statement",
    subreports: [
      new MultiPeriodAccSubReport({
        title: "Cash flow",
        accounts: [cmd_report_accounts_compiled.asset, ...args.accounts],
        positive: true,
        plus: true,
        net: 1,
      })
    ],
    plus: true,
    args: args
  });
  await rep.exec();
}
