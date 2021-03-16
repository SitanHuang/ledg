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
    const commitEntry = (entry) => {
      entry_balance(entry); data.books[year].push(entry);
    };
    
    for await (let line of rl) {
      entry = fs_read_book_proc_line(entry, line, commitEntry);
    }
    if (entry) { commitEntry(entry) }
  }
}

function fs_read_entries_from_string(str) {
  let lines = str.replace(/\r/g, "").split("\n");
  let entries = [];
  
  let entry = null;
  const commitEntry = (entry) => {
    entry_balance(entry); entries.push(entry);
  };
  
  for (let line of rl) {
    entry = fs_read_book_proc_line(entry, line, commitEntry);
  }
  if (entry) { commitEntry(entry) }
  
  return entries;
}

function fs_read_book_proc_line(entry, line, commitEntry) {
  if (line[4] == '-' && line[7] == '-') { // start entry
    if (entry) { commitEntry(entry) } // commit previous

    entry = {
      time: Math.floor(Date.parse(line.substring(0, 10) + 'T00:00:00') / 1000),
      transfers: []
    };
    
    let hash_index = line.indexOf('#');
    
    let UUIDreassigned = false;
          
    if (line.trim().length <= 11 || hash_index < 0) { // has no hash or has no description
      entry.description = line.substring(11);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
    } else if (line.length - hash_index < 9) { // has hash but incomplete uuid
      entry.description = line.substring(11, hash_index - 1);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
    } else {
      entry.description = line.substring(11, line.length - 10).trim();
      entry.uuid = line.substr(line.length - 8, 8);
    }
    
    if (UUIDreassigned) {
      data.booksOpened[year] = DATA_BOOK_DIRTY;
      console.log(`While opening the ${year} book, an entry had incomplete UUID and had been reassigned.`);
    }
  } else if (line[2] == ';') { // entry meta data
    let colonIndex = line.indexOf(':');
    if (colonIndex < 0) { colonIndex = line.length; line += ':""'; }
    entry[line.substring(3, colonIndex)] = JSON.parse(line.substring(colonIndex + 1));
  } else if (line[0] == ' ' && line[1] == ' ') { // transfers
    let t = [];
    let splits = line.substring(2).split('\t');
    if (splits.length >= 2) {
      t[0] = splits[0];
      t[1] = splits[1].trim();
      data.accounts[t[1]] = 1;
      if (splits[2]) splits[2] = splits[2].trim();
      t[2] = splits[2] && splits[2].length ? parseFloat(splits[2]) : 0;
      entry.transfers.push(t);
    }
  }
  return entry;
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
  }));
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
