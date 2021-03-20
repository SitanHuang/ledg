async function cmd_delete(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';
  report_set_modifiers(args);
  report_extract_account(args);
  report_extract_tags(args);

  let filteredEntries = [];
  await report_traverse(args, async function(entry) {
    filteredEntries.push(entry);
  });

  if (!filteredEntries.length) {
    console.log('No such entries found.');
    return 1;
  }

  let targetEntries = [];
  let skip = false;

  for (let i = 0;i < filteredEntries.length;i++) {
    let e = filteredEntries[i];
    if (skip) { targetEntries.push(e); continue; }

    process.stdout.write(`Delete "${print_entry_title(e)}" (y/n/all/enter to abort)? `);
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
    await data_remove_entry(e);
  }

  console.log(`${targetEntries.length} entries are affected.`);
}
