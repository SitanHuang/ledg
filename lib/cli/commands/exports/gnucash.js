async function cmd_export_gnucash_transactions(args) {
  let table = [['Date', 'Num', 'Description', 'Memo', 'Account', 'Deposit', 'Withdrawal']];
  
  let q = { queries: [query_args_to_filter(args)] };
  q.queries[0].collect = ['entries'];

  let data = (await query_exec(q))[0].entries;
  for (let e of data) {
    for (let t of e.transfers) {
      table.push([
        entry_datestr(e),
        e.uuid,
        e.description,
        t[0],
        t[1].replace(/\./g, ':'),
        t[2] >= 0 ? t[2] : '',
        t[2] < 0 ? -t[2] : ''
      ]);
    }
  }
  
  return table;
}
async function cmd_export_gnucash_accounts(args) {
  report_set_accounts(args);
  report_compile_account_regex(args);
  
  let table = [['type','full_name','name','code','description','color','notes','commoditym','commodityn','hidden','tax','placeholder']];
  // ASSET,Assets,Assets,,,,,USD,CURRENCY,F,F,F
  let q = { queries: [query_args_to_filter(args)] };
  await query_exec(q);
  
  let accounts = expand_account();
  for (let a of accounts) {
    let type;
    if (a.match(cmd_report_accounts_compiled.income)) type = "INCOME";
    else if (a.match(cmd_report_accounts_compiled.expense)) type = "EXPENSE";
    else if (a.match(cmd_report_accounts_compiled.asset)) type = "ASSET";
    else if (a.match(cmd_report_accounts_compiled.liability)) type = "LIABILITY";
    else type = "EQUITY";
    table.push([
      type,
      a.replace(/\./g, ':'),
      a.replace(/^(.+\.)*([^.]+)$/, '$2'),
      '',
      '',
      '',
      '',
      'USD',
      'CURRENCY',
      'F',
      'F',
      'F',
    ]);
  }
  
  return table;
}
