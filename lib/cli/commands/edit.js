
async function cmd_edit(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';

  report_set_modifiers(args);
  report_extract_account(args);
  report_extract_tags(args);

  let content = '';

  if (args._[0] != 'new') {
    await report_traverse(args, async function(entry) {
      content += fs_serialize_entry(entry) + '\n';
    });
  }

  let path = fs_get_book_directory() + '/~temp.edit.ledg';
  fs.writeFileSync(path, content);

  let EDITOR = process.env.EDITOR || 'vim';
  let args2 = EDITOR == 'vim' ? ['+autocmd BufRead,BufNewFile *.*.ledg setlocal ts=55 sw=55 expandtab! softtabstop=-1 nowrap listchars="tab:→\ ,nbsp:␣,trail:•,extends:⟩,precedes:⟨" list noautoindent nocindent nosmartindent indentexpr=', path] : [path];

  const ls = require('child_process').spawn(process.env.EDITOR || 'vim', args2, {
    cwd: fs_get_book_directory(),
    stdio: 'inherit'
  });

  ls.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });

  async function callback(code) {
    content = fs.readFileSync(path).toString();
    fs.unlinkSync(path);

    if (code != 0) {
      console.log(`error: editor returned with code ${code}`);
      process.exit(code);
      return;
    }

    let newEntries = 0;
    let affectedEntries = 0;

    let entries = fs_read_entries_from_string(content);
    for (let entry of entries) {
      if (!(await data_modify_entry(entry))) { // new entry
        process.stdout.write(print_entry_ascii(entry) + '\nCreate the above new entry? ');
        let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
        if (args.flags.y) console.log('y');
        if (ans == 'y' || ans == 'yes') {
          await data_push_entry(entry);
          newEntries++;
        } else {
          console.log('Discarded 1 entry.');
        }
      } else affectedEntries++;
    }

    await fs_write_books();
    console.log(`Updated ${affectedEntries} entries and created ${newEntries} entries.`);
    process.exit(code);
  }

  ls.on("close", code => {
    callback(code);
  });
}
