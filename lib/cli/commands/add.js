async function cmd_add(args) {
  let desc = [];
  let transfers = [];
  let currentTransfer = null;

  let opts = JSON.parse(JSON.stringify(args.modifiers));
  
  delete opts.uuid;
  delete opts.time;
  delete opts.from;
  delete opts.to;
  delete opts.description;
  
  args.flags.date = args.flags.date || args.flags.D;
  
  opts.time = ((args.flags.date ? (Date.parse(report_replaceDateStr(args.flags.date) + 'T00:00:00') || new Date().getTime()) : new Date().getTime()) / 1000) | 0;
  
  Object.keys(opts).forEach(k => {
    let n = Number(opts[k]);
    if (!isNaN(n)) opts[k] = n;
  });

  let _ = args._;

  for (let i = 0;i < _.length;i++) {
    let v = _[i].trim().replace(/ /g, '');
    let num = Number(v);
    
    if (v.match(/^\d{4}-\d{2}-\d{2}$/)) {
      opts.time = ((Date.parse(report_replaceDateStr(v) + 'T00:00:00') / 1000) | 0) || opts.time;
    } else if (!isNaN(num)) {
      if (currentTransfer) {
        currentTransfer[2] = num;
        transfers.push(currentTransfer);
        currentTransfer = null;
      } else // entry description
        desc.push(_[i].trim());
    } else if (isArgAccount(v)) { // start account with category
      if (currentTransfer) { // start new one, commit old
        transfers.push(currentTransfer);
        currentTransfer = null;
        continue;
      }
      let accs = fzy_query_account(v, expand_account());
      currentTransfer = ['', null, 0];
      if (accs.length == 0) {
        process.stdout.write(`"${c.bold(v.replace(/\$/g, '').replace(/\!/g, ''))}" does not match anything. Create it? `);
        let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
        if (args.flags.y) console.log('y');
        if (ans == 'y' || ans == 'yes') {
          currentTransfer[1] = v.replace(/\$/g, '').replace(/\!/g, '');
        } else {
          console.log('Abort.');
          return 1;
        }
      } else if (accs.length == 1) {
        currentTransfer[1] = accs[0];
      } else {
        console.log(`Multiple accounts matched for: ${c.bold(v)}\n`);
        for (let j = 0;j < accs.length;j++) {
          console.log(`${j + 1} ${accs[j]}`);
        }
        process.stdout.write('\nChoose one: ');
        let ans = Math.max(Math.min(parseInt((await readline_prompt())) || 1, accs.length), 0) - 1;
        console.log(`${ESC}[1AChoose one: ${c.green(accs[ans])}`);
        currentTransfer[1] = accs[ans];
      }
    }  else {
      if (currentTransfer) // transfer description
        currentTransfer[0] = (currentTransfer[0] + ' ' + _[i].trim()).trim();
      else // entry description
        desc.push(_[i].trim());
    }
  }
  if (currentTransfer) transfers.push(currentTransfer);

  let entry = entry_create(desc.join(" "), transfers, opts);
  console.log("\n" + print_entry_ascii(entry));
  
  // empty
  if (entry.transfers.length == 0) {
    console.log('Empty entry, abort.');
    return 1;
  }
  
  // handle imbalance
  if (entry.transfers.filter(x => x[1] == data_acc_imb).length) {
    process.stdout.write(`Entry is imbalanced, continue? `);
    let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
    if (args.flags.y) console.log('y');
    if (ans != 'y' && ans != 'yes') {
      console.log('Abort.');
      return 1;
    }
  }
  await data_push_entry(entry);
  await fs_write_config();
  console.log('Entry added.');
}
