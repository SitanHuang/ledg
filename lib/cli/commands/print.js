
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

  if (!args.flags['prices-only'])
    report_sort_by_time((await query_exec(q))[0].entries).forEach(entry => {
      console.log(args.flags.ledger ? fs_serialize_entry_ledger(entry, pad) : fs_serialize_entry(entry, exp));
    });
}
