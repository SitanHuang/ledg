
async function cmd_print(args) {
  let q = { queries: [query_args_to_filter(args, ['entries'])] };
  let exp = !!args.flags['show-default-currency'];

  let pad = args.flags['pad-spaces'];
  if (isNaN(pad))
    pad = 45;

  if (args.flags.prices || args.flags['prices-only'])
    for (let com in data.prices) {
      let tree = data.prices[com];
      if (tree.reciprocal)
        continue;

      let [a, b] = com.split(',');
      tree.walk((t, x) => {
        console.log('P ' + entry_datestr(t) + ' ' + a + ' ' + x + b);
      });
    }

  let entries = (await query_exec(q))[0].entries;
  if (args.flags.sort)
    entries = report_sort_by_time(entries);

  if (!args.flags['prices-only']) {
    if (args.flags.rewrite) {
      let years = Object.keys(data.books);
      let skip = false;
      for (let x of years) {
        process.stdout.write(`Rewrite "${x}" journal (y/n/all/enter to abort)? `);
        let ans = skip;
        if (!skip) {
          ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
          if (args.flags.y) console.log('y');
          switch (ans) {
            case 'all':
              skip = ans = true;
            case 'y':
            case 'yes':
              ans = true;
              break;
            case 'n':
            case 'no':
              console.log('Skipped');
              ans = false;
              break;
            default:
              console.log('Abort.');
              return 1;
          }
        }
        if (ans) {
          if (args.flags.sort)
            data.books[x] = report_sort_by_time(data.books[x]);
          data.booksOpened[x] = DATA_BOOK_DIRTY;
        }
      };
    } else {
      entries.forEach(entry => {
        console.log(args.flags.ledger ? fs_serialize_entry_ledger(entry, pad) : fs_serialize_entry(entry, exp));
      });
    }
  }
}
