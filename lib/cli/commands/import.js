async function cmd_import(args) {
  if (!args.flags.source) {
    console.error("Please specify --source, such as --source=A.csv,B.csv");
    return 1;
  }
  if (!args.flags.parser) {
    console.error("Please specify --parser file");
    return 1;
  }

  let code = fs.readFileSync(args.flags.parser.toString());
  let source = args.flags.source.split(/, */);
  for (let path of source) {
    let cmds = await import_csv_exec(code, path);
      // === add ===
    for (let cmd of cmds) {
      cmd = argsparser(cmd);
    
      cmd.flags.confirm = args.flags.confirm;
      cmd.flags.y = args.flags.y;
      cmd.flags['default-pending'] = args.flags['default-pending'];
    
      await cmd_add(cmd);
    }
  }
}