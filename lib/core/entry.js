/*
 * desc = description of entry
 * transfers = [[desc, acc, amnt], ...]
 *  - amnt should be primative, rounded to 2 dec
 * opts = { ... }
 * balanced = pass true if already balanced
 */
function entry_create(desc, transfers, opts, balanced) {
  let e = {
    uuid: nanoid(8),
    time: Math.floor(new Date().getTime() / 1000),
    description: desc,
    transfers: transfers
  };

  Object.assign(e, opts);

  if (!balanced) {
    entry_balance(e);
  }
  return e;
}

function entry_modify_create(desc, transfers, opts, balanced) {
  let e = {};
  if (desc.trim().length)
    e.description = desc;
  Object.assign(e, opts);
  
  if (transfers && transfers.length) {
    e.transfers = transfers;
    if (!balanced) {
      entry_balance(e);
    }
  }

  return e;
}

function entry_balance(e) {
  let balance = entry_check_balance(e.transfers);
  if (balance) {
    if (e.transfers[e.transfers.length - 1][2] == 0) // last entry auto balance
      e.transfers[e.transfers.length - 1][2] = balance;
    else
      e.transfers.push(['', data_acc_imb, balance]);
  }
}

function entry_datestr(entry) {
  let date = new Date((isNaN(entry) ? entry.time : entry) * 1000);
  return date.toISOString().split('T')[0];
}

function entry_check_balance(transfers) {
  let balance = new Big(0);
  for (let t of transfers) {
    balance = balance.add(t[2]);
  }
  return -balance.toNumber();
}
