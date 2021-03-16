function cmd_git(args) {
  let argv = process.argv;
  let i = 1;
  while (++i < argv.length) {
    if (Object.keys(CMD_LIST).filter(x => x.indexOf(argv[i]) == 0).length == 1) break;
  }
  const ls = require('child_process').spawn("git", argv.slice(i + 1), {
    cwd: fs_get_book_directory(),
    stdio: 'inherit'
  });

  ls.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });

  ls.on("close", code => {
    process.exit(code);
  });
}
