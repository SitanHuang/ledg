async function cmd_count(args) {
  let q = { queries: [query_args_to_filter(args)] };
  q.queries[0].collect = ['count'];

  let data = await query_exec(q);

  let count = data[0].count;

  console.log((count).toString());
}
