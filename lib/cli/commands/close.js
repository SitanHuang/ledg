async function cmd_close(args) {
  args.modifiers.from = args.modifiers.from || '@year-start';
  args.modifiers.to = args.modifiers.to || '@year-end';

  args.flags.i = args.flags.i !== false;
  args.flags['skip-book-close'] = true;

  report_set_accounts(args);
  report_compile_account_regex();

  let account = args.flags.account;
  if (!account) {
    console.error('Please specify --account=ACC to store the balances.');
    console.error('Example: --account=Equity.Closed.Y2020');
    return 1;
  }
  account = account.trim();


  let q = { queries: [query_args_to_filter(args)] };
  q.queries[0].collect = ['accounts_sum'];

  let date = entry_datestr(q.queries[0].to);
  let desc = date.replace(/-01/g, '') + ' Book Close';

  let data = await query_exec(q);
  let accs = Object.keys(data[0].accounts_sum).sort();

  let incArgs = [date, desc, 'bookClose:true', '--'];
  let expArgs = [date, desc, 'bookClose:true', '--'];
  for (let a of accs)
    if (a.match(cmd_report_accounts_compiled.income))
      incArgs.push(a + '$', data[0].accounts_sum[a].timesPrim(-1).serialize(true));
    else if (a.match(cmd_report_accounts_compiled.expense))
      expArgs.push(a + '$', data[0].accounts_sum[a].timesPrim(-1).serialize(true));

  incArgs.push(account + '$');
  expArgs.push(account + '$');

  incArgs = argsparser(incArgs);
  incArgs.flags.confirm = args.flags.confirm;

  expArgs = argsparser(expArgs);
  expArgs.flags.confirm = args.flags.confirm;

  await cmd_add(incArgs);
  await cmd_add(expArgs);
}
