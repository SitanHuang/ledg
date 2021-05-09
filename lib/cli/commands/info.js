
async function cmd_info(args) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = undefined;

  report_extract_account(args);
  report_extract_tags(args);

  if (Object.keys(args.modifiers).length == 0 &&
      !args.accounts.length) {
    args.modifiers.from = '@month-start';
    args.modifiers.to = '@max';
    console.log(`No modifiers, using from:@month-start and to:@max\n`);
  } else {
    args.modifiers.from = args.modifiers.from || '@min';
    args.modifiers.to = args.modifiers.to || '@max';
  }

  let flat = args._[0] == 'flat';

  report_set_modifiers(args);

  let entries = [];
  await report_traverse(args, async function(entry) {
    entries.push(entry);
  });
  entries = report_sort_by_time(entries);

  if (flat) {
    report_set_accounts(args);
    report_compile_account_regex();

    let data = [['Date', 'UUID', 'Description', 'Account', 'Amount']];
    let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

    let colorFuncs = [x => c.cyanBright(x),
                      x => c.cyan(x),
                      args.flags['light-theme'] ? x => c.black(x) :
                                                  x => c.whiteBright(x),
                      x => c.yellowBright(x),
                      undefined
                     ];

    for (let e of entries) {
      let account;
      let desc = (e.pending ? c.bold.redBright('! '): '') + e.description;
      if (e.virt)
        desc = c.underline(desc);
      desc = desc  + '        ';
      let amount = new Money();
      if (e.transfers.length <= 2) {
        for (let t of e.transfers) {
          if (t[1].match(cmd_report_accounts.expense)) {
            amount = t[2].timesPrim(-1);
            account = t[1];
            break;
          }
        }
        if (!account) {
          for (let t of e.transfers) {
            if (t[1].match(cmd_report_accounts.liability)) {
              amount = t[2].timesPrim(1);
              account = t[1];
              break;
            }
          }
          if (!account) {
            for (let t of e.transfers) {
              if (t[1].match(cmd_report_accounts.income)) {
                amount = t[2].timesPrim(-1);
                account = t[1];
                break;
              }
            }
          }
        }
      } else {
        let totalPosAmount = new Money();
        let expAmount = new Money();
        for (let t of e.transfers) {
          if (t[1].match(cmd_report_accounts.expense)) expAmount = expAmount.plus(t[2]);
          if (t[2] > 0) totalPosAmount = totalPosAmount.plus(t[2]);
        }
        totalPosAmount = totalPosAmount;
        expAmount = expAmount;
        if (totalPosAmount.eq(expAmount)) {
          amount = totalPosAmount.timesPrim(-1).tryConvertArgs(args, e.time).colorFormat(dp);
          account = '--- Split in ' + e.transfers.length + ' transfers ---';
        }
      }
      if (!account) {
        account = e.bookClose ? '=======  Book Close  ========' : '--- Split in ' + e.transfers.length + ' transfers ---';
        desc = e.bookClose ? '===== ' + e.description + '[' + e.transfers.length + ']' + ' =====' : desc;
        amount = new Money();
        for (let t of e.transfers) {
          if (t[2].gtr(new Money())) amount = amount.plus(t[2]);
        }
        amount = '±' + amount.tryConvertArgs(args, e.time).noColorFormat(dp);
        amount = c.cyanBright(amount);
      } else if (!amount.length) {
        amount = amount.tryConvertArgs(args, e.time).colorFormat(dp);
      }

      data.push([
        entry_datestr(e),
        e.uuid,
        desc,
        account,
        amount
      ]);
    }

    tabulate_less(data, {colorizeColCallback: colorFuncs, align: align});
  } else {
    let maxWidth = print_max_width_from_entries(entries);
    sys_log_startBuf();
    for (let e of entries) {
      console.log(print_entry_ascii(e, maxWidth));
    }
    sys_log_rlsBuf();
  }
}
