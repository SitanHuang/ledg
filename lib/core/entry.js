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
    let balance = entry_check_balance(e.transfers);
    if (balance != 0) {
      e.transfers.push(['Imbalance', data_acc_imb, balance]);
    }
  }
  return e;
}

function entry_datestr(entry) {
  let date = new Date(entry.time * 1000);
  return date.toISOString().split('T')[0];
}

function entry_check_balance(transfers) {
  let balance = new Big(0);
  for (let t of transfers) {
    balance = balance.add(t[2]);
  }
  return -balance.toNumber();
}
