const DEFAULT_COMMAND = 'version';

var cli_args = { _: [], modifiers: {}, flags: {} };

var DEBUG = false;

async function index() {
  let _start = new Date();
  fs_book_name = process.env["LEDG_BOOK"] || fs_book_name;
  let argv = process.argv.slice(2);
  if (fs.existsSync(`${process.env.HOME}/.ledgrc`)) {
    let content = fs.readFileSync(`${process.env.HOME}/.ledgrc`).toString();
    content.replace(/\r/g, '').split("\n").forEach(x => {
      if (x.startsWith("#"))
        return;
      argv = parseArgSegmentsFromStr(x).concat(argv);
    });
  }

  cli_args = args = argsparser(argv);
  fs_set_ignores_list(args.flags.W);
  if (args.flags.debug) DEBUG = true;
  fs_book_name = (args.flags.F || args.flags.file || fs_book_name).replace(/~/g, process.env.HOME || '~');

  // stdin pipe
  if (fs_book_name == '-') {
    stdin_rl.resume();
    let entry = null;
    const commitEntry = (entry) => {
      let year = new Date(entry.time * 1000).getFullYear();
      data.books[year] = data.books[year] || [];
      data.books[year].push(entry);
      data.booksOpened[year] = DATA_BOOK_OPENED;
      _fs_entries_read++;
    };

    for await (let line of stdin_rl) {
      entry = fs_read_book_proc_line(entry, line, commitEntry);
    }
    if (entry) { commitEntry(entry) }
    stdin_rl.pause();
    await fs_get_data_range();
  } else {
    await fs_get_data_range();
    await fs_attempt_load_budgets();
    if (fs.existsSync(fs_book_name + '.config.ledg'))
      await fs_attempt_load_config();
    else if (fs_data_range.length) {
      console.error("Missing config file, reconstructing from existing books");
      await fs_construct_config();
    }
  }

  let _endConfig = new Date();

  report_set_modifiers(args);
  let cmd = CMD_LIST[(args.flags.help || args.flags.H || args.flags.h) ? 'help' : 'accounts'];

  if (args._[0]) {
    let matches = Object.keys(CMD_LIST).filter(x => x.indexOf(args._[0]) == 0).sort();
    if (matches.length == 0) {
      args._.unshift(cmd);
    } else if (matches.length == 1) cmd = CMD_LIST[matches[0]];
    else {
      console.error(`Ambiguous action command ${c.bold(args._[0])}, multiple matches availabe: ${matches.map(x => c.bold(x)).join(", ")}`);
      process.exit(1);
    }
  }

  if (cmd) {
    args._.splice(0,1);
    let _endCmd = new Date();
    let c = await cmd(args);
    if (DEBUG) {
      console.debug(`_endConfig=${_endConfig - _start}ms, _endCmd=${new Date() - _endCmd}ms`);
    }
    if (c) { process.exit(c) }
    else if (fs_book_name != '-') { await fs_write_books(); }
  }
}

var readline_last_value;

async function readline_prompt() {
  stdin_rl.resume();
  const line1 = (await stdin_it.next()).value;
  readline_last_value = line1;
  stdin_rl.pause();
  return line1.trim();
}

var stdin_rl;
var stdin_it;
var ESC = '';

if (require.main === module && typeof TEST == "undefined") {
  stdin_rl = readline.createInterface({
    input: process.stdin, //or fileStream
    //output: process.stdout
  });
  stdin_it = stdin_rl[Symbol.asyncIterator]();
  stdin_rl.pause();
  stdin_rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
  process.on("SIGINT", function () {
    process.exit(1);
  });
  (async function () {
    try {
      await index();
    } catch (e) {
      if (typeof e == 'string')
        console.error(`ERROR: $e`);
       else if (typeof e == 'number')
        process.exit(e);
       else if (e instanceof Error)
        console.error(`ERROR: ${args.flags.debug ? e.stack : e.message}`);
       else
        throw e;
    }
  })();
}
