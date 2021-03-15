const DEFAULT_COMMAND = 'version';

async function index() {
  fs_book_name = process.env["LEDG_BOOK"] || fs_book_name;
  let argv = process.argv;
  if (fs.existsSync(`${process.env.HOME}/.ledgrc`)) {
    let content = fs.readFileSync(`${process.env.HOME}/.ledgrc`).toString();
    argv = content.replace(/\r/g, '').split("\n").concat(argv.slice(2));
  }
  
  var args = argsparser(argv);
  fs_book_name = args.flags.F || args.flags.file || fs_book_name;
  
  await fs_get_data_range();
  if (fs.existsSync(fs_book_name + '.config.ledg'))
    await fs_attempt_load_config();
  else if (fs_data_range.length) {
    console.log("Missing config file, reconstructing from existing books");
    await fs_construct_config();
  }

  report_set_modifiers(args);
  let cmd;
  
  if (args._[0]) {
    let matches = Object.keys(CMD_LIST).filter(x => x.indexOf(args._[0]) == 0).sort();
    if (matches.length == 0) { }
    else if (matches.length == 1) cmd = CMD_LIST[matches[0]];
    else {
      console.log(`Ambiguous action command ${c.bold(args._[0])}, multiple matches availabe: ${matches.map(x => c.bold(x)).join(", ")}`);
      process.exit(1);
    }
  }
  
  if (cmd) {
    args._.splice(0,1);
    let c = await cmd(args);
    if (c) { process.exit(c) }
    else { await fs_write_books(); }
  }
}

var readline_last_value;

async function readline_prompt(muted) {
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
    output: process.stdout
  });
  stdin_it = stdin_rl[Symbol.asyncIterator]();
  stdin_rl.pause();
  index();
} else {
    // console.log('required as a module');
}
