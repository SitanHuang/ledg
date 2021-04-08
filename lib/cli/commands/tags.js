async function cmd_tags(args) {
  let q = { queries: [query_args_to_filter(args, ['entries'])] };

  let data = (await query_exec(q))[0].entries;
  let tags = {};

  for (let e of data) {
    let tag = e[args.flags.field || 'tags'];
    if (!tag) continue;
    tag = tag.split(",");
    for (let t of tag) {
      tags[t] = (tags[t] + 1) || 1;
    }
  }

  tags = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  let table = [['Tag', 'Entries']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT];

  for (let e of tags) {
    table.push(e);
  }

  tabulate_less(table, { align: align });
}
