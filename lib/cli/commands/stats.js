 
async function cmd_stats(args) {  
  let range = await fs_get_data_range();
  await data_open_books(range);
  
  let entries = 0;
  let totalSize = 0;
  
  let table = [['Stat', 'Data']];
  table.push(['File prefix',  fs_book_name]);
  table.push([]);
  
  let accs = {};
  
  for (let y of range) {
    let val = Object.values(data.books[y]).length;
    entries += val;
    let size = fs.statSync(`${fs_book_name}.${y}.ledg`).size / 1024;
    totalSize += size;
    size = Math.round(size * 100) / 100 + ' KiB';
    table.push([y, `${val} entries (${size})`]);
  }
  
  const countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};
  Object.keys(data.accounts).forEach(x => {
    let l = countDots(x);
    accs[l] = (accs[l] || 1) + 1;
  });
  
  totalSize = Math.round(totalSize * 100) / 100 + ' KiB';
  
  table.push(['Total entries', entries + ` (${totalSize})`]);
  table.push([]);
  
  Object.entries(accs).forEach(x => {
    table.push([`Level ${x[0]} accounts`, x[1]]);
  });
  
  table.push(['Total accounts', Object.keys(data.accounts).length]);
  table.push([]);
  
  table.push(['Flags', Object.entries(args.flags).map(x => {
    return (x[0].length == 1 ? '-' : '--') + x[0] + '=' + x[1]
  }).join(", ")]);
  table.push(['Modifiers', Object.entries(args.modifiers).map(x => x.join(":")).join(", ")]);
  
  
  
  console.log(tabulate(table));
}
