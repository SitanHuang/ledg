async function cmd_git(args) {
  let argv = process.argv;
  let i = 1;
  while (++i < argv.length) {
    if (Object.keys(CMD_LIST).filter(x => x.indexOf(argv[i]) == 0).length == 1) break;
  }

  sys_execSync("git", argv.slice(i + 1));
}
