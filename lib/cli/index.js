const DEFAULT_COMMAND = 'version';

async function index() {
  fs_book_name = process.env["LEDG_BOOK"] || fs_book_name;
  await fs_attempt_load_config();

  var args = argsparser(process.argv.slice(2));
  let cmd;
  if (cmd = CMD_LIST[args._[0]]) {
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
