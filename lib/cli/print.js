
function print_entry_ascii(entry) {
  let maxWidth = print_max_width_from_entries([entry]);
  
  let str = c.cyan(entry_datestr(entry)) + ' ' + entry.description.trim() + c.cyan(' #' + entry.uuid);
  for (let key in entry) {
    if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
    str += c.green('\n  ;' + key + ':' + JSON.stringify(entry[key]));
  }
  str += '\n';
  for (let t of entry.transfers) {
    let mon = print_format_money(t[2]);
    str += '  ' + c.yellow(
           (t[0].length ? t[0] + Array(maxWidth.transDesc - t[0].length + 2).fill(' ').join('') : '') +
           t[1] + Array(maxWidth.acc - t[1].length + 2).fill(' ').join('')) +
           Array(maxWidth.mon - mon.length + 2).fill(' ').join('') + print_color_money(t[2]) + '\n';
  }
  return str;
}

function print_max_width_from_entries(entries) {
  let a = { transDesc: 0, acc: 0, mon: 0 };
  let len = entries.length;
  while (len--) {
    let e = entries[len];
    let len2 = e.transfers.length;
    while (len2--) {
      a.transDesc = Math.max(a.transDesc, e.transfers[len2][0].length);
      a.acc = Math.max(a.acc, e.transfers[len2][1].length);
      a.mon = Math.max(a.mon, print_format_money(e.transfers[len2][2]).length);
    }
  }
  return a;
}

function print_format_money(m) {
  return accounting.formatMoney(m);
}

function print_color_money(m) {
  if (m < 0)
    return c.red(print_format_money(m));
  if (m > 0)
    return c.green(print_format_money(m));
  return print_format_money(m);
}
