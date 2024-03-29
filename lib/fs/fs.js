var fs = typeof require != "undefined" ? require('fs') : {};
var readline = typeof require != "undefined" ? require('readline') : {};

var fs_data_range = [];

function fs_get_book_directory() {
  let match = fs_book_name.match(/^(.*\/)([^/]+)$/);
  return match ? match[1] : './';
}

async function fs_get_data_range() {
  if (fs_book_name == '-')
    return fs_data_range = Object.keys(data.books).map(x => Number(x)).sort();

  let result = [];
  fs.readdirSync(fs_get_book_directory()).forEach(x => {
    let m = x.match(/\.(\d{4})\.ledg$/);
    if (m && m[1])
      result.push(parseInt(m[1]));
  });
  return fs_data_range = result.sort();
}

async function fs_write_books() {
  if (fs_book_name == '-' || cli_args.flags['do-not-write-books'])
    return;
  for (let y in data.booksOpened)
    if (data.booksOpened[y] == DATA_BOOK_DIRTY) {
      let path = fs_book_name + '.' + y + '.ledg';
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path);
        for (let i = 0;i < data.books[y].length;i++)
          file.write(fs_serialize_entry(data.books[y][i]) + "\n");

        file.end();
        file.on("finish", resolve);
        file.on("error", reject);
      });
    }
}

async function fs_write_config() {
  if (fs_book_name == '-' || cli_args.flags['do-not-write-config'])
    return;
  let path = fs_book_name + '.config.ledg';
  fs.writeFileSync(path, JSON.stringify({
    data: {
      accounts: data.accounts,
      defaultCurrency: data.defaultCurrency,
      timeclock: data.timeclock,
      precisionTolerance: data.precisionTolerance,
      //accountCurrency: data.accountCurrency,
      priceFiles: data.priceFiles
    },
    data_acc_imb: data_acc_imb
  }, null, 2));
}

function _fs_validate_config_obj(o) {
  if (!o || !o.data ||
      (o.data_acc_imb !== undefined && typeof o.data_acc_imb != 'string' ) ||
      (o.data.priceFiles !== undefined &&
       o.data.priceFiles.constructor.name != 'Array') ||
      (o.data.precisionTolerance !== undefined &&
       typeof o.data.precisionTolerance != 'number') ||
      (o.data.defaultCurrency !== undefined &&
       typeof o.data.defaultCurrency != 'string') ||
      (o.data.accounts !== undefined && typeof o.data.accounts != 'object') ||
      Object.keys(o.data.accounts).filter(x => typeof x != 'string').length)
    throw new ParseError('ERROR reading config file');
}

/*
 * currently supported preprocessing:
 *   - lines beginning with #, !, excluding whitespace
 *   - any c-style comments, excluding those inside any c-style string literal
 *
 * in the future there may be a c-style preprocessor
 */
function _fs_preprocess_config(path) {
  return fs.readFileSync(path)
    .toString()
    .replace(/(?:\/\/(?:\\\n|[^\n])*\n)|(?:\/\*[\s\S]*?\*\/)|((?:R"([^(\\\s]{0,16})\([^)]*\)\2")|(?:@"[^"]*?")|(?:"(?:\?\?'|\\\\|\\"|\\\n|[^"])*?")|(?:'(?:\\\\|\\'|\\\n|[^'])*?'))/g, '$1')
    .replace(/^\s*[#!;].*$/gm, '');
}

async function fs_attempt_load_config() {
  if (fs_book_name == '-')
    return;

  let path = fs_book_name + '.config.ledg';
  if (fs.existsSync(path)) {
    let opts;
    try {
      opts = JSON.parse(_fs_preprocess_config(path));
    } catch (e) {
      err_rethrow(new ParseError(`ERROR reading config file: ${e.message}`), e);
    }

    _fs_validate_config_obj(opts);

    // assign ensures backwards compatibility
    Object.assign(data, opts.data);
    data_acc_imb = opts.data_acc_imb || data_acc_imb;

    // read price files
    let dir = fs_get_book_directory();
    for (let path of data.priceFiles)
      await fs_read_price(dir + path);
  }
}

async function fs_attempt_load_budgets() {
  if (fs_book_name == '-')
    return;
  let path = fs_book_name + '.budgets.ledg';
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path).toString();
    data.budgets = fs_read_budgets_from_string(content);
  }
}

async function fs_construct_config() {
  if (fs_book_name == '-')
    return;
  await data_open_books(await fs_get_data_range());
  await fs_write_config();
}

/* Example:
 *
2021-03-14 Test #UocjnJc1
  ;goose:3.14159
  1	Expense.Taxes.Federal	2000.02
  2	Assets.Checking	-500
  3	Liability.CC	-1449.51
  	Imbalance	-50.51
*/
function fs_serialize_entry(entry, explicit) {
  let tlen = entry.transfers.length;
  if ((entry.clockIn && tlen == 0) || (entry.clockOut && tlen >= 2)) {
    let str = '';
    if (entry.clockIn)
      str += 'i ' + entry_timestr(entry.clockIn) + ' ' +
             (entry._acc || entry.transfers[0][1]) +
             ' ' + entry.description +
             ' #' + entry.uuid + (entry.clockOut ? '\n' : '');
    if (entry.clockOut)
      str += (entry.pending ? 'o' : 'O') + ' ' + entry_timestr(entry.clockOut) +
             ' #' + entry.uuid;
    return _fs_serialize_modifiers(entry, str, true, true) + '\n';
  }
  let str = entry_datestr(entry) +
              (entry.pending ? ' ! ' : ' ') +
              (entry.event ? 'event ' + entry.event + ' ' : '') +
              entry.description.trim() +
              ' #' + entry.uuid;
  str = _fs_serialize_modifiers(entry, str);
  str += '\n';
  for (let t of entry.transfers)
    str += '  ' + t[0] + '\t' + t[1] + '\t' + t[2].serialize(explicit) + '\n';

  return str;
}
function _fs_serialize_modifiers(entry, str, skipVirt, skipClocks, skipEvent) {
  FOR: for (let key in entry) {
    switch (key) {
      case 'description':
      case 'time':
      case 'uuid':
      case 'transfers':
      case 'pending':
        continue FOR;
    }
    if (key == 'virt' && skipVirt)
      continue FOR;
    if ((key == 'clockIn' || key == 'clockOut') && skipClocks)
      continue FOR;
    if (key[0] == '_')
      continue FOR;
    if (key == 'event' && !skipEvent)
      continue FOR;
    str += '\n  ;' + key + ':' + JSON.stringify(entry[key]);
  }
  return str;
}

function fs_serialize_entry_ledger(entry, pad=45, timeclock) {
  let tlen = entry.transfers.length;
  if (timeclock && ((entry.clockIn && tlen == 0) || (entry.clockOut && tlen >= 2))) {
    let str = '';
    if (entry.clockIn)
      str += 'i ' + entry_timestr(entry.clockIn) + ' ' +
             (entry._acc || entry.transfers[0][1])
                   .replace(/:/g, ESC).replace(/\./g, ':')
                  .replace(new RegExp(ESC, "i"), '.').padEnd(pad, ' ') +
             '  ' + entry.description +
             ' #' + entry.uuid + (entry.clockOut ? '\n' : '');
    if (entry.clockOut)
      str += (entry.pending ? 'o' : 'O') + ' ' + entry_timestr(entry.clockOut);
    return _fs_serialize_modifiers(entry, str, true, true, true) + '\n';
  }

  let str = entry_datestr(entry) +
              (entry.pending ? ' ! ' : ' ') +
              entry.description.trim() +
              ' #' + entry.uuid;
  str = _fs_serialize_modifiers(entry, str, true, false, true);
  str += '\n';
  for (let t of entry.transfers) {
    if (t[0])
      str += '  ;' + t[0] + '\n';
    let acc = t[1].replace(/:/g, ESC).replace(/\./g, ':')
                  .replace(new RegExp(ESC, "i"), '.');
    if (entry.virt)
      acc = '[' + acc + ']';
    Object.keys(t[2].amnts).forEach(cur => {
      let amnt = new Money(t[2].amnts[cur], cur);
      str += '  ' +
             acc.padEnd(pad, ' ') + '  ' +
             amnt.serialize(1) + '\n';
    });
  }
  return str;
}

/*
 * ========================
 * FS runtime variables
 * ========================
 */
var fs_book_name = 'book'; // ex: book.2019.ledg, book.ledg, book.budget.ledg

