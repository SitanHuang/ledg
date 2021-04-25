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

  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = undefined;
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
  let max_t = fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000;
  let to = Math.floor((Date.parse(report_replaceDateStr(cmd_report_modifiers.to) + 'T00:00:00') - 1000 || max_t) / 1000);

  report_extract_account(args);
  report_extract_tags(args);
  let balanceData = await report_sum_accounts(args, sumParent);
  let accounts = Object.keys(balanceData);

  let table = [["Accounts", "Balance"]];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT];

  let sum = new Money();

  let accs = accounts.sort((a, b) =>
    (args.flags.sort && balanceData[b].compare(balanceData[a])) ||
    a.localeCompare(b)
  ); // wait for open book then key

  if (tree) {
    if (args.flags['hide-zero'])
      accounts = accounts.filter(x => !balanceData[x].isZero());
    let accTree = print_accountTree(accounts);

    let i = -1;
    accTree.list.forEach((x) => {
      let fullAcc = accTree.fullList[++i];
      //if (args.flags['hide-zero'] && balanceData[fullAcc].isZero()) return;
      if (countDots(fullAcc) > args.flags['max-depth']) return;
      let amnt = balanceData[fullAcc] || new Money();
      if (amnt) sum = sum.plus(amnt);
      table.push([x, amnt.tryConvertArgs(args, to || undefined).colorFormat(dp)]);
    });
  } else {
    accs.forEach((x) => {
      if (args.flags['hide-zero'] && balanceData[x].isZero()) return;
      if (countDots(x) > args.flags['max-depth']) return;
      if (balanceData[x]) sum = sum.plus(balanceData[x]);
      table.push([x, balanceData[x].tryConvertArgs(args, to || undefined).colorFormat(dp)]);
    });
  }
  if (args.flags.sum)
    table.push(['Sum', sum.tryConvertArgs(args, to || undefined).colorFormat(dp)]);
  tabulate_less(table, { align: align });
}
