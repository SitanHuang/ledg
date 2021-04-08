#!/usr/bin/env node

const fs = require('fs');

function help() {
  console.log('ledg-time <[setup|init]|[i|clock-in|in]>');
  console.log('          <[o|clock-out|out]> "AccountName" "Description"');
}

function ledg(args, inherit) {
  if (inherit)
    require('child_process').spawnSync('ledg', args, {stdio: 'inherit'});
  else
    return require('child_process').spawnSync('ledg', args).stdout.toString().trim();
}

function ledgEval(sc) {
  return ledg(['eval', 'sc']);
}

function isSetup() {
  return ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("hr,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("Hr,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("sec,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("Sec,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("day,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("Day,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("d,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("h,")).length') == 'true' &&
         ledgEval('!!Object.keys(data.prices).filter(x => x.startsWith("s,")).length') == 'true';
}

let cmd = process.argv[2];
let argv = process.argv;

let fs_book_name = ledgEval('fs_book_name');
let fs_get_book_directory = ledgEval('fs_get_book_directory()');

switch (cmd) {
  case 'setup':
  case 'init':
    if (isSetup()) {
      console.log('It seems like ledg-time is already setup.');
      return 1;
    }
    let price_file = fs_get_book_directory + 'time.prices.ledg';
    if (fs.existsSync(price_file)) {
      console.log(`${price_file} already exists.`);
      return 1;
    }
    let content = '; ====== Time Units =====\n' +
                  '; Generated by ledg-time\n' +
                  '; --- Shortnames ---\n' +
                  'P 0000-01-01 h 1H\n' +
                  'P 0000-01-01 h 1Hr\n' +
                  'P 0000-01-01 h 1hr\n' +
                  'P 0000-01-01 h 1hour\n' +
                  'P 0000-01-01 s 1S\n' +
                  'P 0000-01-01 s 1Sec\n' +
                  'P 0000-01-01 s 1sec\n' +
                  'P 0000-01-01 s 1second\n' +
                  'P 0000-01-01 m 1M\n' +
                  'P 0000-01-01 m 1Min\n' +
                  'P 0000-01-01 m 1min\n' +
                  'P 0000-01-01 m 1minute\n' +
                  'P 0000-01-01 d 1D\n' +
                  'P 0000-01-01 d 1Day\n' +
                  'P 0000-01-01 d 1day\n' +
                  '; --- Conversions ---\n' +
                  'P 0000-01-01 m 60s\n' +
                  'P 0000-01-01 h 60m\n' +
                  'P 0000-01-01 d 24h\n' +
                  '\n\n';
    fs.writeFileSync(price_file, content);
    ledgEval(`
      data.accounts.Income = data.accounts.Expense = 1;
      data.priceFiles.push("time.prices.ledg");
      fs_write_config();
    `);
    break;
  case 'i':
  case 'clock-in':
  case 'in':
    fs.writeFileSync(fs_get_book_directory + '.clock-in.ledg-time', new Date().getTime().toString());
    break;
  case 'o':
  case 'clock-out':
  case 'out':
    let from;
    try {
      from = fs.readFileSync(fs_get_book_directory + '.clock-in.ledg-time').toString().trim();
      from = new Date(Number(from));
      if (isNaN(from)) throw '';
    } catch (e) {
      console.log('Error reading .clock-in.ledg-time');
      return;
    }
    let now = new Date();
    let d = (now - from) / 1000 | 0;
    let day = d / 60 / 60 / 24 | 0;
    let hour = (d - day * 60 * 60 * 24) / 60 / 60 | 0;
    let minute = (d - day * 60 * 60 * 24 - hour * 60 * 60) / 60 | 0;
    let second = d - day * 60 * 60 * 24 - hour * 60 * 60 - minute * 60;
    let str = [];
    if (day) str.push(day + 'd');
    if (hour) str.push(hour + 'h');
    if (minute) str.push(minute + 'm');
    if (second) str.push(second + 's');
    ledg([
      'add',
      'virt:true',
      'clockIn:' + from.toISOString(),
      'clockOut:' + now.toISOString(),
      (argv[3] || 'Expense') + '$',
      str.join(", "),
      'Income$',
      '--',
      argv.slice(4).join(' ')
    ], true);
    fs.unlinkSync(fs_get_book_directory + '.clock-in.ledg-time');
    break;
  default:
    help();
    break;
}
