
function print_entry_ascii(entry, maxWidth, args=cli_args) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = undefined;

  maxWidth = maxWidth || print_max_width_from_entries([entry]);
  let alignrightwidth = 2 + maxWidth.transDesc + (maxWidth.transDesc ? 2 : 0) + maxWidth.acc + 2 + maxWidth.mon - 9 - 10 - (entry.description ? entry.description.length : 0) - (entry.pending ? 2 : 0);
  let spacePad = Array(Math.max(alignrightwidth, maxWidth.desc + 2 - (entry.description ? entry.description.length : 0) - (entry.pending ? 2 : 0))).fill(' ').join('');
  let str = c.cyanBright.bold(entry.time ? entry_datestr(entry) : '[time]') +
            (entry.pending ? c.redBright.bold(' ! ') : ' ') +
            (typeof entry.description == 'string' ? entry.description : '[title]').trim() +
            spacePad + c.cyan(entry.uuid ? (' #' + (entry.uuid)) : ' [uuid]');
  let timeclock = cli_args.flags['tc-expose'] ? false :
                    (entry.clockIn && !entry.clockOut && entry.transfers.length == 0 ||
                    entry.clockOut && !entry.clockIn && entry.transfers.length >= 2);
  if (timeclock) {
    str = print_entry_title(entry, Array(Math.max(alignrightwidth, maxWidth.desc - 10 + 2 - (entry.description ? entry.description.length : 0))).fill(' ').join(''));
  }
  FOR: for (let key in entry) {
    if (key[0] == '_')
      continue FOR;
    switch (key) {
      case 'virt':
      case 'clockIn':
      case 'clockOut':
        if (timeclock)
          continue FOR;
        break;
      case 'description':
      case 'time':
      case 'uuid':
      case 'transfers':
      case 'pending':
        continue FOR;
    }
    str += c.green('\n  ;' + key + ':' + JSON.stringify(entry[key]));
  }
  str += '\n';
  if (!timeclock) {
    for (let t of entry.transfers) {
      let amnt = t[2].tryConvertArgs(args, entry.time);
      let mon = amnt.noColorFormat(dp);
      str += '  ' +
             (maxWidth.transDesc ? t[0] + Array(maxWidth.transDesc - t[0].length + 2).fill(' ').join('') : '') +
             c.yellowBright(t[1] + Array(maxWidth.acc - t[1].length + 2).fill(' ').join('')) +
             Array(maxWidth.mon - mon.length + 2).fill(' ').join('') + amnt.colorFormat(dp) + '\n';
    }
  }
  return str;
}

function print_entry_title(e, pad='') {
  if (!cli_args.flags['tc-expose'] && e.clockIn && !e.clockOut && e.transfers.length == 0) {
    return c.cyanBright(c.bold('i ') + entry_timestr(e.clockIn)) + ' ' +
           c.yellowBright.bold(e.description.trim()) +
           pad +
           c.cyan('#' + e.uuid);
  } else if (!cli_args.flags['tc-expose'] && e.clockOut && !e.clockIn && e.transfers.length >= 2) {
    return (e.pending ? c.redBright.bold('o') : c.cyanBright.bold('O')) +
           ' ' + c.cyanBright(entry_timestr(e.clockOut)) +
           pad +
           c.cyan(' #' + e.uuid);
  }
  return c.cyanBright(entry_datestr(e)) +
         (e.pending ? c.redBright.bold(' ! ') : ' ') +
         c.yellowBright.bold(e.description.trim()) +
         c.cyan(' #' + e.uuid);
}

function print_header_style(str) {
  return c.underline(str);
}

function print_alternate_row(row, i) {
  if (cli_args.flags['light-theme'])
    return i % 2 ? `${ESC}[48;5;255m${(row)}${ESC}[49m` : row;
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
    let el = e.description ? e.description.length : 0;
    if (!cli_args.flags['tc-expose'] && e.clockIn && !e.clockOut && e.transfers.length == 0) {
      a.desc = Math.max(a.desc, el + 11);
    } else if (!cli_args.flags['tc-expose'] && e.clockOut && !e.clockIn && e.transfers.length >= 2) {
      a.desc = Math.max(a.desc, 11);
    } else {
      a.desc = Math.max(a.desc, el + (e.pending ? 2 : 0));
      let len2 = e.transfers.length;
      while (len2--) {
        a.transDesc = Math.max(a.transDesc, e.transfers[len2][0].length);
        a.acc = Math.max(a.acc, e.transfers[len2][1].length);
        a.mon = Math.max(a.mon, e.transfers[len2][2].noColorFormat().length);
      }
    }
  }
  return a;
}

/* Deprecated
function print_format_money(m) {
  return accounting.formatMoney(m);
}
*/

function print_truncate_account(acc, depth) {
  let a = acc.split('.');
  a.length = Math.min(Math.max(depth, 0), a.length);
  return a.join('.');
}

function print_color_money(m, plus) {
  if (m < 0)
    return c.redBright(print_format_money(m));
  if (m > 0)
    return c.green((plus ? '+' : '') + print_format_money(m));
  return print_format_money(m);
}

function print_progress_bar(a, b, x, opts) {
  opts = opts || {};
  let def = { width: 50, colorThisString: null, colorizeLow: c.bgGreen, colorizeMid: c.bgYellow, colorizeHigh: c.bgRed, reverseLowHigh: false };
  Object.assign(def, opts);
  opts = def;

  let perc = Math.max(Math.min((x-a) / (b-a), 1), 0);
  let bar = Math.round(perc * opts.width);
  let bg = opts.width - bar;

  let colorBar = opts.reverseLowHigh ? (perc < 0.15 ? opts.colorizeHigh : (perc > 0.85 ? opts.colorizeLow : opts.colorizeMid))
                                 :(perc < 0.65 ? opts.colorizeLow : (perc > 0.9 ? opts.colorizeHigh : opts.colorizeMid));
  if (opts.colorThisString) {
    return colorBar(opts.colorThisString);
  }

  if (cli_args.flags.format) {
    return Array(bar).fill('#').join('') +
           Array(bg).fill('_').join('');
  }

  let str = colorBar(new Array(bar).fill(' ').join('')) +
            (cli_args.flags['light-theme'] ?  `${ESC}[48;5;255m` : `${ESC}[48;5;234m` ) +
            (new Array(bg).fill(' ').join('')) + `${ESC}[49m`;

  return str;
}

const print_monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
  ];
const print_quarterNames = ["First", "Second", "Third", "Fourth"];
function print_full_month(m) {
  return print_monthNames[m];
}

function print_full_quarter(m) {
  return print_quarterNames[m / 3 | 0];
}

function pring_week(d) {
  var onejan = new Date(d.getFullYear(),0,1);
  var today = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  var dayOfYear = ((today - onejan + 86400000)/86400000);
  return Math.ceil(dayOfYear/7)
};
