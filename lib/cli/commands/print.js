
async function cmd_print(args) {
  let q = { queries: [query_args_to_filter(args, ['entries'])] };
  let exp = !!args.flags['show-default-currency'];

  report_sort_by_time((await query_exec(q))[0].entries).forEach(entry => {
    console.log(args.flags.ledger ? fs_serialize_entry_ledger(entry) : fs_serialize_entry(entry, exp));
  });
}
