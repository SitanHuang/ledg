var _fs_entries_read = 0;
function fs_read_book(year) {
  return new Promise((resolve, reject) => {
    let _start;
    if (DEBUG)
      _start = new Date();
    let path = fs_book_name + '.' + year + '.ledg';
    data.books[year] = [];
    if (fs_book_name != '-' && fs.existsSync(path)) {
      let fileStream = fs.createReadStream(path);

      let rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let entry = null;
      const commitEntry = (entry) => {
        try {
          entry_balance(entry, true);
        } catch (e) {
          reject(e);
          rl.close();
        }
        // console.log("commit====");
        // console.log(entry.transfers.map(x => [x[0], x[1], x[2].toString()]));
        data.books[year].push(entry);
        _fs_entries_read++;
      };

      rl.on('line', (line) => {
        try {
          entry = fs_read_book_proc_line(entry, line, commitEntry);
        } catch (e) {
          reject(e);
          rl.close();
        }
      });
      rl.on('close', () => {
        if (entry) { commitEntry(entry) }
        if (DEBUG)
          console.debug(`Opened ${year} book in ${new Date() - _start}ms, ${_fs_entries_read} entries read so far`);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function fs_read_entries_from_string(str) {
  let lines = str.replace(/\r/g, "").split("\n");
  let entries = [];

  let entry = null;
  const commitEntry = (entry) => {
    entry_balance(entry, true);
    entries.push(entry);
  };

  for (let line of lines)
    entry = fs_read_book_proc_line(entry, line, commitEntry);

  if (entry)
    commitEntry(entry)

  return entries;
}

function fs_read_book_proc_line(entry, line, commitEntry) {
  let trimmedLine = line.trim();
  if (line[0] == ';')
    return entry;
  if (line[4] == '-' && line[7] == '-') { // start entry
    if (entry)
      commitEntry(entry) // commit previous

    entry = {
      time: Math.floor(Date.parse(line.substring(0, 10) + 'T00:00:00') / 1000),
      transfers: []
    };

    let hash_index = line.indexOf('#');

    let UUIDreassigned = false;

    // has no hash or has no description
    if (trimmedLine.length <= 11 || hash_index < 0) {
      entry.description = line.substring(11);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
      // has hash but incomplete uuid
    } else if (line.length - hash_index < 9) {
      entry.description = line.substring(11, hash_index - 1);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
    } else {
      entry.description = line.substring(11, line.length - 10).trim();
      entry.uuid = line.substr(line.length - 8, 8);
    }

    if (entry.description.startsWith('! ')) {
      entry.description = entry.description.substring(2);
      entry.pending = true;
    }

    if (UUIDreassigned) {
      let year = new Date(entry.time * 1000).getFullYear();
      data.booksOpened[year] = DATA_BOOK_DIRTY;
      console.log(`While opening the ${year} book, an entry had incomplete UUID and had been reassigned.`);
    }
  } else if (entry && line[2] == ';') { // entry meta data
    let colonIndex = line.indexOf(':');
    if (colonIndex < 0) {
      colonIndex = line.length;
      line += ':""';
    }
    entry[line.substring(3, colonIndex)] = JSON.parse(line.substring(colonIndex + 1));
  } else if (entry && line[0] == ' ' && line[1] == ' ') { // transfers
    let t = [];
    let splits = line.substring(2).split('\t');
    if (splits.length >= 2) {
      t[0] = splits[0];
      t[1] = splits[1].trim();
      data.accounts[t[1]] = 1;
      if (splits[2])
        splits[2] = splits[2].trim();
      t[2] = Money.parseMoney(splits[2] && splits[2].length ? splits[2] : '0',
                              entry.time);
      if (t[2] === false && !err_ignores_list["invalid-amount-format"])
        throw new ParseError(`Cannot parse ${splits[2]} as a value.`);
      t[2] = t[2] || new Money();
      entry.transfers.push(t);
    }
  } else if (trimmedLine.length && !err_ignores_list["unknown-book-directive"]) {
    throw new ParseError(`"${line}": unknown book directive`);
  }
  return entry;
}
