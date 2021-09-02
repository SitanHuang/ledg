const os = require('os');

const DEFAULT_COMMAND = 'version';

var cli_args = { _: [], modifiers: {}, flags: {} };

var DEBUG = false;

async function index() {
  let _start = new Date();
  fs_book_name = process.env["LEDG_BOOK"] || fs_book_name;
  let argv = process.argv.slice(2);

  function reparseArgs(_argv) {
    let tmp = argsparser(_argv);

    Object.assign(cli_args.modifiers, tmp.modifiers);
    Object.assign(cli_args.flags, tmp.flags);

    err_set_ignores_list(cli_args.flags.W);

    DEBUG = !!cli_args.flags.debug;

    fs_book_name = (cli_args.flags.F || cli_args.flags.file || fs_book_name)
                      .replace(/^~(?=[\/\\])/g, process.env.HOME || os.homedir());

    return tmp._;
  }

  reparseArgs(argv);

  function readRCFile(path) {
    if (fs.existsSync(path)) {
      let content = fs.readFileSync(path).toString();
      content.replace(/\r/g, '').split("\n").forEach(x => {
        if (x.startsWith("#"))
          return;
        reparseArgs(parseArgSegmentsFromStr(x));
      });
    }
  }

  if (!cli_args.flags['no-config']) {
    readRCFile(`${process.env.HOME}/.ledgrc`);

    // if process.argv specified book, load .ledgrc of that directory
    // otherwise, load .ledgrc of the book directory specified by ~/.ledgrc args
    reparseArgs(argv);

    readRCFile(`${fs_get_book_directory()}/.ledgrc`);
    if (process.cwd() != process.env.HOME)
      readRCFile(`${process.cwd()}/.ledgrc`);
  }

  for (let key in cli_args.flags) {
    if (!key.startsWith('alias-'))
      continue;
    let alias = key.substring(6);

    for (let i = 0;i < argv.length;i++)
      if (argv[i] == alias)
        argv[i] = parseArgSegmentsFromStr(cli_args.flags[key]);
  }
  argv = argv.flat();

  cli_args._ = reparseArgs(argv);
  if (DEBUG)
    console.debug(cli_args);

  let args = cli_args;

  if (args.flags['tc-prices'] !== false)
    time_init_pricedb();

  // stdin pipe
  if (fs_book_name == '-') {
    stdin_rl.resume();
    let entry = null;
    const commitEntry = (entry) => {
      entry_balance(entry, true);
      let year = new Date(entry.time * 1000).getFullYear();
      data.books[year] = data.books[year] || [];
      data.books[year].push(entry);
      data.booksOpened[year] = DATA_BOOK_OPENED;
      _fs_entries_read++;
    };

    let stat = { clockIn: {} };
    for await (let line of stdin_rl) {
      entry = fs_read_book_proc_line(entry, line, commitEntry, stat);
    }
    if (entry) { commitEntry(entry) }
    stdin_rl.pause();
    await fs_get_data_range();
  } else {
    await fs_get_data_range();
    await fs_attempt_load_budgets();
    if (fs.existsSync(fs_book_name + '.config.ledg')) {
      await fs_attempt_load_config();
    } else if (fs_data_range.length) {
      console.error("Missing config file, reconstructing from existing books");
      await fs_construct_config();
    }
  }

  let include_prices = cli_args.flags['include-prices'];
  if (include_prices) {
    include_prices = include_prices.toString().split(",");
    for (let x of include_prices)
      await fs_read_price(x.trim());
  }

  let _endConfig = new Date();

  report_set_modifiers(args);
  let cmd = CMD_LIST[(args.flags.help || args.flags.H || args.flags.h) ? 'help' :
              (args.flags.version || args.flags.v) ? 'version' : 'accounts'];

  if (args._[0]) {
    let match = CMD_LIST[args._[0]];
    let matches = match ? [args._[0]] : Object.keys(CMD_LIST)
                    .filter(x => x.indexOf(args._[0]) == 0).sort();
    if (matches.length == 0)
      args._.unshift(cmd);
    else if (matches.length == 1)
      cmd = CMD_LIST[matches[0]];
    else {
      console.error(`Ambiguous action command ${c.bold(args._[0])}, multiple matches availabe: ${matches.map(x => c.bold(x)).join(", ")}`);
      process.exit(1);
    }
  }

  if (cmd) {
    args._.splice(0,1);
    let _endCmd = new Date();
    let c = await cmd(args);

    if (DEBUG)
      console.debug(`_endConfig=${_endConfig - _start}ms, _endCmd=${new Date() - _endCmd}ms`);

    if (c)
      process.exit(c);
    else if (fs_book_name != '-')
      await fs_write_books();

    stdin_rl.close();
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
        console.error(`ERROR: ${e}`);
       else if (typeof e == 'number')
        process.exit(e);
       else if (e instanceof Error)
        console.error(`ERROR: ${cli_args.flags.debug ? e.stack : e.message}`);
       else
        throw e;
    }
  })();
}
