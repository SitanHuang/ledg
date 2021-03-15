 
async function cmd_info(args) {
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
