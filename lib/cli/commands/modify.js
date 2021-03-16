async function cmd_modify(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';
  report_set_modifiers(args);
  
  let filteredEntries = [];
  await report_traverse(args, async function(entry) {
    filteredEntries.push(entry);
  });
  
  if (!filteredEntries.length) {
    console.log('No such entries found.');
    console.log('Modifiers are used for query, not modification. Use edit command to edit entry modifiers');
    return 1;
  }
  
  
  // =================================================
  //                     cmd_add
  // =================================================
  
  
  let opts = await cmd_add(args, true);
  if (typeof opts != 'object') return opts; // abnormal return code
  
  // =================================================
  //            ask for which ones to modify
  // =================================================
  let targetEntries = [];
  let skip = false;
  
  targetEntries.push(filteredEntries[0]);
  for (let i = 1;i < filteredEntries.length;i++) {
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
    Object.assign(e, opts);
    await data_modify_entry(e);
  }
  
  console.log(`${filteredEntries.length} entries are affected.`);
} 
