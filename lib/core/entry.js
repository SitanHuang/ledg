/*
 * desc = description of entry
 * transfers = [[desc, acc, amnt], ...]
 *  - amnt should be primative, rounded to 2 dec
 * opts = { ... }
 * balanced = pass true if already balanced
 */
function entry_create(desc, transfers, opts, balanced, emitError) {
  let e = {
    uuid: nanoid(8),
    time: Math.floor(new Date().getTime() / 1000),
    description: desc,
    transfers: transfers
  };

  Object.assign(e, opts);

  if (!balanced)
    entry_balance(e);
  return e;
}

function entry_modify_create(desc, transfers, opts, balanced) {
  let e = {};
  if (desc.trim().length)
    e.description = desc;
  Object.assign(e, opts);

  if (transfers && transfers.length) {
    e.transfers = transfers;
    if (!balanced)
      entry_balance(e);
  }

  return e;
}

function entry_balance(e, emitError) {
  let balance = entry_check_balance(e.transfers);

  if (balance && cli_args.flags['balance-to-currency'])
    balance = balance.tryConvertArgs({
      flags: {
        currency: cli_args.flags['balance-to-currency'],
        // should only balance to e.time
        // "valuation-date": cli_args.flags['valuation-date']
      }
    }, e.time);

  if (balance && !balance.isZero(data.precisionTolerance || 0)) {
    let lastAmnt = e.transfers[e.transfers.length - 1][2];

    if (lastAmnt.isZero(data.precisionTolerance || 0)) { // last entry auto balance
      e.transfers[e.transfers.length - 1][2] = balance;
    } else {
      data.accounts[data_acc_imb] = 1;

      if (emitError && !err_ignores_list['imbalanced-entries'])
        throw new EntryImbalancedError(`#${e.uuid} ${entry_datestr(e)} has an imbalance of ${balance.toString()}`);

      e.transfers.push(['', data_acc_imb, balance]);
    }
  }
}

function entry_check_balance(transfers) {
  let balance;
  // assumes the dates in the transfers
  // are set up correctly for valuation
  for (let t of transfers)
    if (!balance)
      balance = t[2];
    else
      balance = balance.plus(t[2]);

  if (!balance)
    return 0;

  balance = balance.removeEmpty();

  if (balance.isZero(data.precisionTolerance || 0))
    return 0;
  return balance.timesPrim(-1);
}

// ===================================
// the following functions change timezone offset
// because nodejs' toISOString puts out UTC time
// ===================================

function date_local_iso(date=new Date()) {
  date = new Date(date * 1000 - (date.getTimezoneOffset() * 60000));
  return date.toISOString().split('T')[0];
}

function entry_datestr(entry) {
  let date = new Date((isNaN(entry) ? entry.time : entry) * 1000);
  date = new Date(date - date.getTimezoneOffset() * 60000);
  return date.toISOString().split('T')[0];
}

function entry_timestr(entry) {
  let date = new Date(
    (typeof entry == 'string' ?
      Date.parse(entry) :
      ((isNaN(entry) ? entry.time : entry) * 1000)));
  date = new Date(date - date.getTimezoneOffset() * 60000);
  date = date.toISOString();
  return date.substring(0, 10) + ' ' + date.substring(11, 19);
}
