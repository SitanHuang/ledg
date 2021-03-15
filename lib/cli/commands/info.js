 
async function cmd_info(args) {
  if (Object.keys(args.modifiers).length == 0) {
    args.modifiers.from = '@month-start';
    args.modifiers.to = '@max';
    console.log(`No modifiers, using from:@month-start and to:@max\n`);
  } else {
    args.modifiers.from = args.modifiers.from || '@min';
    args.modifiers.to = args.modifiers.to || '@max';
  }
  
  report_set_modifiers(args);
  
  let entries = [];
  await report_traverse(args, async function(entry) {
    entries.push(entry);
  });
  entries = entries.sort((a, b) => a.time - b.time);
  let maxWidth = print_max_width_from_entries(entries);
  for (let e of entries) {    
    console.log(print_entry_ascii(e, maxWidth));
  }
}
