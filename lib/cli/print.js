
function print_entry_ascii(entry, maxWidth) {
  maxWidth = maxWidth || print_max_width_from_entries([entry]);
  let alignrightwidth = 2 + maxWidth.transDesc + (maxWidth.transDesc ? 2 : 0) + maxWidth.acc + 2 + maxWidth.mon - 9 - 10 - (entry.description ? entry.description.length : 0);
  let str = c.cyanBright.bold(entry.time ? entry_datestr(entry) : '[time]') + ' ' + (typeof entry.description == 'string' ? entry.description : '[title]').trim() +
            Array(Math.max(alignrightwidth, maxWidth.desc + 2 - (entry.description ? entry.description.length : 0))).fill(' ').join('') + c.cyan(entry.uuid ? (' #' + (entry.uuid)) : ' [uuid]');
  for (let key in entry) {
    if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
    str += c.green('\n  ;' + key + ':' + JSON.stringify(entry[key]));
  }
  str += '\n';
  for (let t of entry.transfers) {
    let mon = print_format_money(t[2]);
    str += '  ' +
           (maxWidth.transDesc ? t[0] + Array(maxWidth.transDesc - t[0].length + 2).fill(' ').join('') : '') +
           c.yellowBright(t[1] + Array(maxWidth.acc - t[1].length + 2).fill(' ').join('')) +
           Array(maxWidth.mon - mon.length + 2).fill(' ').join('') + print_color_money(t[2]) + '\n';
  }
  return str;
}

function print_entry_title(entry) {
  return c.cyanBright(entry_datestr(entry)) + ' ' + c.yellowBright.bold(entry.description.trim()) + c.cyan(' #' + entry.uuid);
}

function print_header_style(str) {
  return c.underline(str);
}

function print_alternate_row(row, i) {
  return i % 2 ? `${ESC}[48;5;234m${(row)}${ESC}[49m` : row;
}

function print_pad_right(str, num, len) {
  if ((len || str.length) >= num) return str;
  return str + Array(1 + num - (len || str.length)).join(' ');
}
function print_pad_left(str, num, len) {
  if ((len || str.length) >= num) return str;
  return Array(1 + num - (len || str.length)).join(' ') + str;
}

function print_max_width_from_entries(entries) {
  let a = { transDesc: 0, desc: 0, acc: 0, mon: 0 };
  let len = entries.length;
  while (len--) {
    let e = entries[len];
    a.desc = Math.max(a.desc, e.description ? e.description.length : 0);

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
    return c.redBright(print_format_money(m));
  if (m > 0)
    return c.green(print_format_money(m));
  return print_format_money(m);
}
