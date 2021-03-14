async function cmd_add(args) {
  let desc = [];
  let transfers = [];
  let currentTransfer = null;

  let opts = JSON.parse(JSON.stringify(args.modifiers));
  
  delete opts.uuid;
  delete opts.time;
  delete opts.description;
  
  Object.keys(opts).forEach(k => {
    let n = Number(opts[k]);
    if (!isNaN(n)) opts[k] = n;
  });

  let _ = args._;

  for (let i = 0;i < _.length;i++) {
    let v = _[i].trim().replace(/ /g, '');
    let num = parseFloat(v);
    
    
    if (v.indexOf(".") >= 0) { // start account with category
      if (currentTransfer) { // start new one, commit old
        transfers.push(currentTransfer);
        currentTransfer = null;
        continue;
      }
      let accs = fzy_query_account(v);
      currentTransfer = ['', null, 0];
      if (accs.length == 0) {
        process.stdout.write(`"${c.bold(v)}" does not match anything. Create it? `);
        let ans = (await readline_prompt()).toLowerCase();
        if (ans == 'y' || ans == 'yes') {
          currentTransfer[1] = v;
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
        let ans = Math.max(Math.min(parseInt((await readline_prompt())) || 1, accs.length), 1) - 1;
        console.log(`${ESC}[1AChoose one: ${c.green(accs[ans])}`);
      }
    } else if (!isNaN(num)) {
      if (!currentTransfer) {
        console.error(c.red(`Error: Unexpected num ${num}, please put account name in front.`));
        return 1;
      }
      currentTransfer[2] = num;
      transfers.push(currentTransfer);
      currentTransfer = null;
    } else {
      if (currentTransfer) // transfer description
        currentTransfer[0] = (currentTransfer[0] + ' ' + v).trim();
      else // entry description
        desc.push(v);
    }
  }
  if (currentTransfer) transfers.push(currentTransfer);

  let entry = entry_create(desc.join(" "), transfers, opts);
  console.log("\n" + print_entry_ascii(entry) + "\n");
  
  // handle imbalance
  if (entry.transfers.filter(x => x[1] == data_acc_imb).length) {
    process.stdout.write(`Entry is imbalanced, continue? `);
    let ans = (await readline_prompt()).toLowerCase();
    if (ans != 'y' && ans != 'yes') {
      console.log('Abort.');
      return 1;
    }
  }
  await data_push_entry(entry);
  await fs_write_config();
  console.log('Entry added.');
}
