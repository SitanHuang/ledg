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

      let stat = { clockIn: {} };

      rl.on('line', (line) => {
        try {
          entry = fs_read_book_proc_line(entry, line, commitEntry, stat);
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
  let stat = { clockIn: {} };

  for (let line of lines)
    entry = fs_read_book_proc_line(entry, line, commitEntry, stat);

  if (entry)
    commitEntry(entry)

  return entries;
}

const _fs_tc_checkin_regex = /^i\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?)\s*(([^\s]+)(.*))?$/;
const _fs_tc_checkout_regex = /^[oO]\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?)\s*(#.{8})?$/;
function fs_read_book_proc_line(entry, line, commitEntry, stat) {
  let trimmedLine = line.trim();
  if (line[0] == ';')
    return entry;

  let match;
  if ((line[0] == 'O' || line[0] == 'o') && (match = line.match(_fs_tc_checkout_regex))) {
    if (entry)
      commitEntry(entry) // commit previous

    let date = match[1];
    let timestamp = Math.floor(Date.parse(date) / 1000);
    let pending = line[0] == 'o';
    let dateObj = new Date(timestamp * 1000);
    let uuid = match[3];
    if (uuid) {
      uuid = uuid.substring(1);
    } else {
      let year = dateObj.getFullYear();
      uuid = nanoid(8);
      data.booksOpened[year] = DATA_BOOK_DIRTY;
      if (!err_ignores_list["timeclock-uuid-reassigned-warning"])
        console.log(`While opening the ${year} book, a timeclock check-out had incomplete UUID and had been reassigned.`);
    }

    entry = {
      time: timestamp,
      clockOut: date,
      description: "",
      virt: true,
      uuid: uuid,
      transfers: []
    };
    if (pending)
      entry.pending = true;

    let i = -1;
    let sum = new Money(0, 's', timestamp);
    for (let acc in stat.clockIn) {
      i++;
      let ientry = stat.clockIn[acc];
      let clockIn = ientry[0];
      let amnt = new Money(0, 's', timestamp);

      data.accounts[acc] = 1;

      let delta = timestamp - clockIn;

      let days = Math.floor(delta / 86400);
      delta -= days * 86400;

      let hours = Math.floor(delta / 3600) % 24;
      delta -= hours * 3600;

      let minutes = Math.floor(delta / 60) % 60;
      delta -= minutes * 60;

      let seconds = delta % 60;

      // in d:h:s order
      if (days)
        amnt.amnts['d'] = new Big(days);
      if (hours)
        amnt.amnts['h'] = new Big(hours);
      if (minutes)
        amnt.amnts['m'] = new Big(minutes);
      if (seconds)
        amnt.amnts['s'] = new Big(seconds);
      else
        delete amnt.amnts['s'];

      sum = sum.plus(amnt);
      entry.transfers.push([ientry[1], acc, amnt]);
    }
    if (i == -1 && !err_ignores_list['timeclock-checkout-without-checkin'])
      throw new ParseError('Cannot checkout without a checkin: ' + line);
    data.accounts[data.timeclock.income] = 1;
    entry.transfers.push(['', data.timeclock.income, sum.timesPrim(-1)]);
    stat.clockIn = {};

  } else if (line[0] == 'i' && (match = line.match(_fs_tc_checkin_regex))) {
    if (entry)
      commitEntry(entry) // commit previous

    // date is to the exact second, not just the day
    // hopefully commands don't have problem with this
    let date = match[1];
    let acc = match[4] || data.timeclock.expense;
    let desc = match[5] ? match[5].trim() : '';

    let timestamp = Math.floor(Date.parse(date) / 1000);
    let dateObj = new Date(timestamp * 1000);
    entry = {
      time: timestamp,
      clockIn: date,
      _acc: acc,
      virt: true,
      transfers: []
    };

    if (stat.clockIn[acc] && !err_ignores_list['timeclock-double-checkin'])
      throw new ParseError('Cannot double check-in to the same account: ' + line);

    let hash_index = desc.indexOf('#');

    let UUIDreassigned = false;

    // has no hash or has no description
    if (hash_index < 0) {
      entry.description = desc;
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
      // has hash but incomplete uuid
    } else if (desc.length - hash_index < 9) {
      entry.description = desc.substring(0, hash_index - 1);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
    } else {
      entry.description = desc.substring(0, desc.length - 9).trim();
      entry.uuid = desc.substr(desc.length - 8, 8);
    }

    stat.clockIn[acc] = [timestamp, entry.description];

    if (UUIDreassigned) {
      let year = dateObj.getFullYear();
      data.booksOpened[year] = DATA_BOOK_DIRTY;
      if (!err_ignores_list["timeclock-uuid-reassigned-warning"])
        console.log(`While opening the ${year} book, a timeclock check-in had incomplete UUID and had been reassigned.`);
    }
  } else if (line[4] == '-' && line[7] == '-') { // start entry
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
      if (!err_ignores_list["uuid-reassigned-warning"])
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

      // since no other components actually put data.accounts
      // fs.js have to do it
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
