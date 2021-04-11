var fs = typeof require != "undefined" ? require('fs') : {};
var readline = typeof require != "undefined" ? require('readline') : {};

var fs_data_range = [];

const fs_ignores_list = {
  "invalid-price-declaration": false,
  "unknown-book-directive": false
};

function fs_set_ignores_list(str) {
  str = str || '';
  let args = str.split(",");
  for (let arg of args) {
    arg = arg.trim();
    if (arg == 'all') {
      for (let key in fs_ignores_list)
        fs_ignores_list[key] = true;
      return;
    }
    fs_ignores_list[arg] = true;
  }
}

function fs_get_book_directory() {
  let match = fs_book_name.match(/^(.*\/)([^/]+)$/);
  return match ? match[1] : './';
}

async function fs_get_data_range() {
  if (fs_book_name == '-') {
    return fs_data_range = Object.keys(data.books).map(x => Number(x)).sort();
  }
  let result = [];
  fs.readdirSync(fs_get_book_directory()).forEach(x => {
    let m = x.match(/\.(\d{4})\.ledg$/);
    if (m && m[1]) result.push(parseInt(m[1]));
  });
  return fs_data_range = result.sort();
}

async function fs_write_books() {
  if (fs_book_name == '-') return;
  for (let y in data.booksOpened) {
    if (data.booksOpened[y] == DATA_BOOK_DIRTY) {
      let path = fs_book_name + '.' + y + '.ledg';
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path);
        for (let i = 0;i < data.books[y].length;i++) {
          file.write(fs_serialize_entry(data.books[y][i]) + "\n");
        }
        file.end();
        file.on("finish", resolve);
        file.on("error", reject);
      });
    }
  }
}

async function fs_write_config() {
  if (fs_book_name == '-') return;
  let path = fs_book_name + '.config.ledg';
  fs.writeFileSync(path, JSON.stringify({
    data: {
      accounts: data.accounts,
      defaultCurrency: data.defaultCurrency,
      //accountCurrency: data.accountCurrency,
      priceFiles: data.priceFiles
    },
    data_acc_imb: data_acc_imb
  }, null, 2));
}

function _fs_validate_config_obj(o) {
  if (!o || !o.data ||
      (o.data_acc_imb !== undefined && typeof o.data_acc_imb != 'string' ) ||
      (o.data.priceFiles !== undefined && o.data.priceFiles.constructor.name != 'Array') ||
      (o.data.defaultCurrency !== undefined && typeof o.data.defaultCurrency != 'string') ||
      (o.data.accounts !== undefined && typeof o.data.accounts != 'object') ||
      Object.keys(o.data.accounts).filter(x => typeof x != 'string').length)
    throw new ParseError('ERROR reading config file');
}

async function fs_attempt_load_config() {
  if (fs_book_name == '-') return;
  let path = fs_book_name + '.config.ledg';
  if (fs.existsSync(path)) {
    let opts;
    try {
      opts = JSON.parse(fs.readFileSync(path));
    } catch (e) {
      err_rethrow(new ParseError(`ERROR reading config file: ${e.message}`), e);
    }

    _fs_validate_config_obj(opts);

    // assign ensures backwards compatibility
    Object.assign(data, opts.data);
    data_acc_imb = opts.data_acc_imb || data_acc_imb;

    // read price files
    let dir = fs_get_book_directory();
    for (let path of data.priceFiles) {
      await fs_read_price(dir + path);
    }
  }
}

async function fs_attempt_load_budgets() {
  if (fs_book_name == '-') return;
  let path = fs_book_name + '.budgets.ledg';
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path).toString();
    data.budgets = fs_read_budgets_from_string(content);
  }
}

async function fs_construct_config() {
  if (fs_book_name == '-') return;
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
  let str = entry_datestr(entry) + ' ' + entry.description.trim() + ' #' + entry.uuid;
  for (let key in entry) {
    if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
    str += '\n  ;' + key + ':' + JSON.stringify(entry[key]);
  }
  str += '\n';
  for (let t of entry.transfers) {
    str += '  ' + t[0] + '\t' + t[1] + '\t' + t[2].serialize(explicit) + '\n';
  }
  return str;
}

function fs_serialize_entry_ledger(entry) {
  let str = entry_datestr(entry) + ' ' + entry.description.trim() + ' #' + entry.uuid;
  FOR: for (let key in entry) {
    switch (key) {
      case 'description':
      case 'time':
      case 'uuid':
      case 'transfers':
      case 'virt':
        continue FOR;
    }
    str += '\n  ;' + key + ':' + JSON.stringify(entry[key]);
  }
  str += '\n';
  for (let t of entry.transfers) {
    if (t[0]) str += '  ;' + t[0] + '\n';
    let acc = t[1].replace(/:/g, ESC).replace(/\./g, ':').replace(new RegExp(ESC, "i"), '.');
    if (entry.virt)
      acc = '[' + acc + ']';
    Object.keys(t[2].amnts).forEach(cur => {
      let amnt = new Money(t[2].amnts[cur], cur);
      str += '  ' +
             acc +
             '     ' + amnt.serialize(1) + '\n';
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
