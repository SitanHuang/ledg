var _fs_entries_read = 0;
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
      _fs_entries_read++;
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
  
  for (let line of lines) {
    entry = fs_read_book_proc_line(entry, line, commitEntry);
  }
  if (entry) { commitEntry(entry) }
  
  return entries;
}

function fs_read_book_proc_line(entry, line, commitEntry) {
  if (line[0] == ';') return entry;
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
      let year = new Date(entry.time * 1000).getFullYear();
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
