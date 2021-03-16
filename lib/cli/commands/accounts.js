async function cmd_accounts(args) {
  if (args._[0] == 'add') {
    for (let i = 1;i < args._.length;i++) {
      data.accounts[args._[i]] = 1;
    }
    await fs_write_config();
    console.log('Saved to ' + fs_book_name + '.config.ledg');
    return;
  }
  
  if (args.modifiers.from && args.modifiers.from.length) {
    delete args.modifiers.from;
    cmd_report_modifiers.from = '';
    console.log("Warning: from modifier is ignored in account command\n");
  }
  
  let tree = args._[0] == 'tree';
  
  if (args.flags['sum-parent'] === false && args.flags['max-depth']) {
    args.flags['sum-parent'] = true;
    console.log("Warning: with max-depth, sum-parent is always enabled");
  } else if (args.flags['max-depth'] && !tree) {
    console.log("sum-parent is enabled with max-depth set");
  }
  
  args.flags['max-depth'] = args.flags['max-depth'] || Infinity;
  let countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};
  
  let sumParent = typeof args.flags['sum-parent'] === 'undefined' ? tree : args.flags['sum-parent']; // tree default to sum parent
  
  report_extract_account(args);
  let balanceData = await report_sum_accounts(args, sumParent);
  let accounts = Object.keys(balanceData);
  
  
  let width = "Accounts".length;
  let width2 = "Balance".length;
  accounts.forEach(x => {
    width2 = Math.max(width2, print_format_money(balanceData[x]).length);
  });
  
  let accs = accounts.sort(); // wait for open book then key
  
  if (tree) {
    if (args.flags['hide-zero'])
      accounts = accounts.filter(x => balanceData[x] != 0);
    let accTree = print_accountTree(accounts);
    
    console.log(`\n${print_header_style(print_pad_right("Accounts", accTree.maxLength))} ${print_header_style(print_pad_right("Balance", width2))}`);
    
    let i = -1;
    accTree.list.forEach((x) => {
      if (args.flags['hide-zero'] && balanceData[x] == 0) return;
      if (countDots(accTree.fullList[++i]) > args.flags['max-depth']) return;
      console.log(print_alternate_row(`${print_pad_right(x, accTree.maxLength)} ${print_pad_left(print_color_money(balanceData[accTree.fullList[i]]), width2, print_format_money(balanceData[accTree.fullList[i]]).length)}`, i));
    });
  } else {
    accs.forEach(x => width = Math.max(width, x.length)); 
  
  
    console.log(`\n${print_header_style(print_pad_right("Accounts", width))} ${print_header_style(print_pad_right("Balance", width2))}`);
    let i = 0;
    accs.forEach((x) => {
      if (args.flags['hide-zero'] && balanceData[x] == 0) return;
      if (countDots(x) > args.flags['max-depth']) return;
      console.log(print_alternate_row(`${print_pad_right(x, width)} ${print_pad_left(print_color_money(balanceData[x]), width2, print_format_money(balanceData[x]).length)}`, i++));
    });
    console.log("");
  }
}
