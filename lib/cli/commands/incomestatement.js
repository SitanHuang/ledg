async function cmd_incomestatement(args) {
  report_set_accounts(args);
  report_compile_account_regex();

  args.accounts = args.accounts || [];

  let rep = new MultiPeriodAccReport({
    title: "Income Statement",
    subreports: [
      new MultiPeriodAccSubReport({
        title: "Income",
        accounts: [cmd_report_accounts_compiled.income, ...args.accounts],
        invert: true,
        positive: true,
        plus: true,
        net: 1,
      }),
      new MultiPeriodAccSubReport({
        title: "Expenses",
        accounts: [cmd_report_accounts_compiled.expense, ...args.accounts],
        positive: false,
        plus: true,
        net: -1,
      }),
    ],
    plus: true,
    args: args
  });
  await rep.exec();
}
