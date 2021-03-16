async function cmd_modify(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';
  report_set_modifiers(args);
  //report_extract_account(args);
  
  let filteredEntries = [];
  await report_traverse(args, async function(entry) {
    filteredEntries.push(entry);
  });
  
  if (!filteredEntries.length) {
    console.log('No such entries found.');
    console.log('Modifiers are used for query, not modification. Use edit command to edit entry modifiers');
    return 1;
  }
  
  let mods_to_remove = (args.flags['remove-mod'] || '').split(",").filter(x => x != 'uuid' && x != 'time' && x != 'description' && x != 'transfers');
  let mods_to_set = (args.flags['set-mod'] || '').split(",");
  mods_to_set = argsparser(mods_to_set).modifiers;
  delete mods_to_set.uuid;
  delete mods_to_set.time;
  delete mods_to_set.description;
  delete mods_to_set.transfers;
  
  // =================================================
  //                     cmd_add
  // =================================================
  
  Object.assign(args.modifiers, mods_to_set);
  let opts = await cmd_add(args, true);
  if (typeof opts != 'object') return opts; // abnormal return code
  
  // =================================================
  //            ask for which ones to modify
  // =================================================
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
  
  let tags_to_add = (args.flags['add-tag'] || '').split(",").map(x => x.toUpperCase()).filter(x => x && x.length);
  let tags_to_remove = (args.flags['remove-tag'] || '').split(",").map(x => x.toUpperCase()).filter(x => x && x.length);
  
  for (let e of targetEntries) {
    Object.assign(e, opts);
    mods_to_remove.forEach(x => delete e[x]);
    if (tags_to_add.length) {
      for (let tag of tags_to_add) {
        tag_add(e, tag);
      }
    }
    if (tags_to_remove.length) {
      for (let tag of tags_to_remove) {
        tag_remove(e, tag);
      }
    }
    await data_modify_entry(e);
  }
  
  console.log(`${targetEntries.length} entries are affected.`);
} 
