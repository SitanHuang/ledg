async function cmd_export(args) {
  args.flags.csv = args.flags.csv !== false;
  let table;
  switch (args._[0]) {
    case 'gnucash-transactions':
      table = await cmd_export_gnucash_transactions(args);
      break;
    case 'gnucash-accounts':
      table = await cmd_export_gnucash_accounts(args);
      break;
    default:
      console.error(`'${args._[0]}' is not an export option.`);
      return 1;
  }
  console.log(tabulate(table));
}
