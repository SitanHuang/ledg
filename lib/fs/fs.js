var fs = typeof require != "undefined" ? require('fs') : {};
var readline = typeof require != "undefined" ? require('readline') : {};

async function fs_read_book(year) {
  let path = fs_book_name + '.' + year + '.ledg';
  data.books[year] = [];
  if (fs.existsSync(path)) {
    let fileStream = fs.createReadStream(path);

    let rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    let entry = null;
    for await (let line of rl) {
      if (line[4] == '-' && line[7] == '-') { // start entry
        if (entry) { entry_balance(entry); data.books[year].push(entry); } // commit previous

        entry = {};
        entry.description = line.substring(11, line.length - 10);
        entry.time = Math.floor(Date.parse(line.substring(0, 10)) / 1000);
        entry.uuid = line.substr(line.length - 8, 8);
        entry.transfers = [];
      } else if (line[2] == ';') { // entry meta data
        let colonIndex = line.indexOf(':');
        entry[line.substring(3, colonIndex)] = JSON.parse(line.substring(colonIndex + 1));
      } else if (line[0] == ' ' && line[1] == ' ') { // transfers
        let t = [];
        let splits = line.substring(2).split('\t');
        if (splits.length >= 2) {
          t[0] = splits[0];
          t[1] = splits[1].trim();
          if (splits[2]) splits[2] = splits[2].trim();
          t[2] = splits[2] && splits[2].length ? parseFloat(splits[2]) : 0;
          entry.transfers.push(t);
        }
      }
    }
    if (entry) { entry_balance(entry); data.books[year].push(entry); }
  }
}

async function fs_write_books() {
  for (let y in data.booksOpened) {
    if (data.booksOpened[y] == DATA_BOOK_DIRTY) {
      let path = fs_book_name + '.' + y + '.ledg';
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path);
        for (const entry of data.books[y]) {
          file.write(fs_serialize_entry(entry) + "\n");
        }
        file.end();
        file.on("finish", resolve);
        file.on("error", reject);
      });
    }
  }
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
