
async function cmd_info(args) {
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
  entries = entries.sort((a, b) => a.time - b.time);

  if (flat) {
    report_set_accounts(args);
    report_compile_account_regex();

    let data = [['Date', 'UUID', 'Description', 'Account', 'Amount']];
    let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

    let colorFuncs = [x => c.cyanBright(x),
                      x => c.cyan(x),
                      x => c.whiteBright(x),
                      x => c.yellowBright(x),
                      undefined
                     ];

    for (let e of entries) {
      let account;
      let desc = e.description + '        ';
      let amount = 0;
      if (e.transfers.length <= 2) {
        for (let t of e.transfers) {
          if (t[1].match(cmd_report_accounts.expense)) {
            amount = -t[2];
            account = t[1];
            break;
          }
        }
        if (!account) {
          for (let t of e.transfers) {
            if (t[1].match(cmd_report_accounts.liability)) {
              amount = t[2];
              account = t[1];
              break;
            }
          }
          if (!account) {
            for (let t of e.transfers) {
              if (t[1].match(cmd_report_accounts.income)) {
                amount = -t[2];
                account = t[1];
                break;
              }
            }
          }
        }
      } else {
        let totalPosAmount = new Big(0);
        let expAmount = new Big(0);
        for (let t of e.transfers) {
          if (t[1].match(cmd_report_accounts.expense)) expAmount = expAmount.plus(t[2]);
          if (t[2] > 0) totalPosAmount = totalPosAmount.plus(t[2]);
        }
        totalPosAmount = totalPosAmount.toNumber();
        expAmount = expAmount.toNumber();
        if (totalPosAmount == expAmount) {
          amount = [print_color_money(-totalPosAmount), print_format_money(-totalPosAmount).length];
          account = '--- Split in ' + e.transfers.length + ' transfers ---';
        }
      }
      if (!account) {
        account = e.bookClose ? '=======  Book Close  ========' : '--- Split in ' + e.transfers.length + ' transfers ---';
        desc = e.bookClose ? '===== ' + e.description + '[' + e.transfers.length + ']' + ' =====' : desc;
        amount = new Big(0);
        for (let t of e.transfers) {
          if (t[2] > 0) amount = amount.plus(t[2]);
        }
        amount = '±' + print_format_money(amount.toNumber());
        amount = [c.cyanBright(amount), amount.length];
      } else if (!amount.length) {
        amount = [print_color_money(amount), print_format_money(amount).length];
      }

      data.push([
        entry_datestr(e),
        e.uuid,
        desc,
        account,
        amount
      ]);
    }

    console.log(tabulate(data, {colorizeColCallback: colorFuncs, align: align}) + '\n');
  } else {
    let maxWidth = print_max_width_from_entries(entries);
    for (let e of entries) {
      console.log(print_entry_ascii(e, maxWidth));
    }
  }
}
