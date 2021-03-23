 
async function cmd_print(args) {
  let q = { queries: [query_args_to_filter(args)] };
  q.queries[0].callback = async function (entry) {
    console.log(fs_serialize_entry(entry));
  };

  await query_exec(q);
}
