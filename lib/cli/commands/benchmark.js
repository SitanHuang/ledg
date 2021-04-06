async function cmd_benchmark(args) {
  if (args._[0] == 'test') {
    let m = new Money(1, 'hr');
    console.log(m.toString());
    console.log(m.plus(new Money(1, 'min')).toString());
    console.log(m.plus(new Money(1, 'min')).convert('sec').toString());
    return;
  }
  let times = Number(args._[0]) || 100;
  for (let i = 0;i < times;i++) {
    data_init_data();
    await data_open_books(await fs_get_data_range());
  }
  console.log(_fs_entries_read + ' entries read');
}
