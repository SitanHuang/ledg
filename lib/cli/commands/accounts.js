async function cmd_accounts(args) {
  // ===============================================================
  //                           add accounts
  // ===============================================================
  if (args._[0] == 'add') {
    let i = 1;
    for (;i < args._.length;i++) {
      let acc = args._[i];
      data.accounts[acc] = 1;
    }
    await fs_write_config();
    console.log(`Saved ${i - 1} account names to ` + fs_book_name + '.config.ledg');
    return;
  }

  // ===============================================================
  //                          rename accounts
  // ===============================================================
  if (args._[0] == 'rename') {
    let source = args._[1];
    let dst = args._[2];

    args.modifiers.from = args.modifiers.from || '@min';
    args.modifiers.to = args.modifiers.to || '@max';
    report_set_modifiers(args);

    let filteredEntries = [];
    await report_traverse(args, async function(entry) {
      for (let t of entry.transfers) {
        if (t[1].match(source)) {
          filteredEntries.push(entry);
          break;
        }
      }
    });

    let targetEntries = [];
    let skip = false;

    if (filteredEntries.length == 1) targetEntries.push(filteredEntries[0]);
    for (let i = targetEntries.length;i < filteredEntries.length;i++) {
      let e = filteredEntries[i];
      if (skip) { targetEntries.push(e); continue; }

      process.stdout.write(`Modify "${print_entry_title(e)}" (y/n/all/enter to abort)? `);
      let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
      if (args.flags.y) console.log('y');
      switch (ans) {
        case 'y':
        case 'yes':
          targetEntries.push(e);
          break;
        case 'n':
        case 'no':
          console.log('Skipped');
          break;
        case 'all':
          skip = true;
          targetEntries.push(e);
          break;
        default:
          console.log('Abort.');
          return 1;
      }
    }

    for (let e of targetEntries) {
      for (let t of e.transfers) {
        t[1] = t[1].replace(source, dst);
      }
      await data_modify_entry(e);
    }

    await fs_write_config();
    console.log('Saved to ' + fs_book_name + '.config.ledg');
    return;
  }


  // ===============================================================
  //                         sum up accounts
  // ===============================================================

  if (args.modifiers.from && args.modifiers.from.length) {
    console.log("Warning: using from modifier might result in wrong summation of asset and liability accounts\n");
  }

  let tree = args._[0] == 'tree';

  if (args.flags['sum-parent'] === false && args.flags['max-depth']) {
    args.flags['sum-parent'] = true;
    console.log("Warning: with max-depth, sum-parent is always enabled");
  } else if (args.flags['max-depth'] && !tree) {
    args.flags['sum-parent'] = true;
    console.log("sum-parent is enabled with max-depth set");
  }

  args.flags['max-depth'] = args.flags['max-depth'] || Infinity;
  let countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};

  let sumParent = !!args.flags['sum-parent'];
  if (sumParent && args.flags.sum && args.flags['max-depth'] == Infinity) {
    console.log("Warning: With --sum-parent and no --max-depth, --sum might produce wrong results.\n");
  }

  report_extract_account(args);
  let balanceData = await report_sum_accounts(args, sumParent);
  let accounts = Object.keys(balanceData);


  let width = "Accounts".length;
  let width2 = "Balance".length;
  let sum = new Big(0);
  accounts.forEach(x => {
    width2 = Math.max(width2, print_format_money(balanceData[x]).length);
  });

  let accs = accounts.sort(); // wait for open book then key

  if (tree) {
    if (args.flags['hide-zero'])
      accounts = accounts.filter(x => balanceData[x] != 0);
    let accTree = print_accountTree(accounts);
    width = accTree.maxLength;

    console.log(`\n${print_header_style(print_pad_right("Accounts", accTree.maxLength))} ${print_header_style(print_pad_right("Balance", width2))}`);

    let i = -1;
    accTree.list.forEach((x) => {
      if (args.flags['hide-zero'] && balanceData[x] == 0) return;
      if (countDots(accTree.fullList[++i]) > args.flags['max-depth']) return;
      if (balanceData[accTree.fullList[i]]) sum = sum.plus(balanceData[accTree.fullList[i]]);
      console.log(print_alternate_row(`${print_pad_right(x, accTree.maxLength)} ${print_pad_left(print_color_money(balanceData[accTree.fullList[i]]), width2, print_format_money(balanceData[accTree.fullList[i]]).length)}`, i));
    });
  } else {
    accs.forEach(x => width = Math.max(width, x.length));


    console.log(`\n${print_header_style(print_pad_right("Accounts", width))} ${print_header_style(print_pad_right("Balance", width2))}`);
    let i = 0;
    accs.forEach((x) => {
      if (args.flags['hide-zero'] && balanceData[x] == 0) return;
      if (countDots(x) > args.flags['max-depth']) return;
      if (balanceData[x]) sum = sum.plus(balanceData[x]);
      console.log(print_alternate_row(`${print_pad_right(x, width)} ${print_pad_left(print_color_money(balanceData[x]), width2, print_format_money(balanceData[x]).length)}`, i++));
    });
  }
  sum = sum.toNumber();
  if (args.flags.sum) console.log(c.bold(`${print_pad_right('Sum', width)} ${print_pad_left(print_format_money(sum), width2, print_format_money(sum).length)}`));
  console.log("");
}
