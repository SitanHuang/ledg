var fs = typeof require != "undefined" ? require('fs') : {};
var readline = typeof require != "undefined" ? require('readline') : {};

var fs_data_range = [];

function fs_get_book_directory() {
  let match = fs_book_name.match(/^(.*\/)([^/]+)$/);
  return match ? match[1] : '.';
}

async function fs_get_data_range() {
  let result = [];
  fs.readdirSync(fs_get_book_directory()).forEach(x => {
    let m = x.match(/\.(\d{4})\.ledg$/);
    if (m && m[1]) result.push(parseInt(m[1]));
  });
  return fs_data_range = result.sort();
}

async function fs_write_books() {
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
  let path = fs_book_name + '.config.ledg';
  // TODO: need to be async later
  fs.writeFileSync(path, JSON.stringify({
    data: { accounts: data.accounts },
    data_acc_imb: data_acc_imb
  }, null, 2));
}

async function fs_attempt_load_config() {
  let path = fs_book_name + '.config.ledg';
  // TODO: need to be async later
  try {
    let opts = JSON.parse(fs.readFileSync(path));
    Object.assign(data, opts.data);
    data_acc_imb = opts.data_acc_imb || data_acc_imb;
  } catch (e) {}
}

async function fs_attempt_load_budgets() {
  let path = fs_book_name + '.budgets.ledg';
  // TODO: need to be async later
  try {
    let content = fs.readFileSync(path).toString();
    data.budgets = fs_read_budgets_from_string(content);
  } catch (e) {}
}

async function fs_construct_config() {
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
function fs_serialize_entry(entry) {
  let str = entry_datestr(entry) + ' ' + entry.description.trim() + ' #' + entry.uuid;
  for (let key in entry) {
    if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
    str += '\n  ;' + key + ':' + JSON.stringify(entry[key]);
  }
  str += '\n';
  for (let t of entry.transfers) {
    str += '  ' + t[0] + '\t' + t[1] + '\t' + t[2] + '\n';
  }
  return str;
}

/*
 * ========================
 * FS runtime variables
 * ========================
 */
var fs_book_name = 'book'; // ex: book.2019.ledg, book.ledg, book.budget.ledg
