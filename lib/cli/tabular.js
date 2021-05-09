
/*
 * `data` structure:
 * [
 *   [[text, realWidth], [text, realWidth], header: true],
 *   [[text, realWidth], [text, realWidth]],
 * ]
 */
function tabulate(data, opts) {
  if (!data.length || !data[0].length)
    return '';

  let def = {
    maxWidths: new Array(data[0].length).fill(Infinity),
    minWidths: new Array(data[0].length).fill(0),
    align: new Array(data[0].length).fill(TAB_ALIGN_LEFT),
    colBorder: '  ',
    rowBorder: undefined,
    alternateColor: true,
    transpose: cli_args.flags.transpose,
    firstRowIsHeader: true,
    sortBody: false,
    colorizeColCallback: new Array(data[0].length)
  };
  Object.assign(def, opts);
  opts = def;

  let dcols = cli_args.flags['drop-columns'];
  if (dcols != null) { // covers undefined too
    let dropped = 0;
    dcols.toString().split(",").map(x => parseInt(x)).sort().forEach(x => {
      x -= dropped++;
      opts.maxWidths.splice(x, 1);
      opts.minWidths.splice(x, 1);
      opts.align.splice(x, 1);
      opts.colorizeColCallback.splice(x, 1);
      data.forEach(row => {
        row.splice(x, 1);
      });
    });
  }

  if (opts.transpose) {
    let t = [];
    for (let i = 0;i < data[0].length;i++) {
      t[i] = [];
      for (let j = 0;j < data.length;j++)
        t[i][j] = data[j][i] || '';
    }
    data = t;
    opts.maxWidths = new Array(data[0].length).fill(Infinity);
    opts.minWidths = new Array(data[0].length).fill(0);
    opts.align = new Array(data[0].length).fill(TAB_ALIGN_RIGHT);
  }

  if (opts.firstRowIsHeader && data[0].header !== false)
    data[0].header = data[0] !== false;

  let alternateRowIndex = 0;
  if (cli_args.flags.html) {
    let width = data[0].length;
    let html = '<table class="ledg-export">';
    for (let i = 0;i < data.length;i++) {
      let row = data[i];

      let style = "";

      if (row.resetAlternateColor)
        alternateRowIndex = 0;
      if (opts.alternateColor && alternateRowIndex++ % 2)
        style += "background: #eee;";

      html += `\n<tr style="${style}">`;

      for (let j = 0;j < width;j++) {
        let col = row[j] || '';
        let tag = row.header ? 'th' : 'td';
        let _opts = '';

        let align = opts.align[j] || (col && col.align);
        if (align == TAB_ALIGN_RIGHT)
          _opts += ' align=right';
        else if (align == TAB_ALIGN_RIGHT)
          _opts += ' align=right';

        if (col.htmlClass)
          _opts += ` class="${col.htmlClass}"`;

        let content = strip_ansi((typeof col == 'object' && col.pop) ?
                                 col[0].toString() :
                                 col.toString())
                        .replace(/ /g, '&nbsp;');

        if (col.htmlTag)
          content = `<${col.htmlTag}>${content}</${col.htmlTag}>`;
        if (row.htmlTitle)
          content = `<${row.htmlTitle}>${content}</${row.htmlTitle}>`;
        html += `<${tag}${_opts}>${content}</${tag}>`;
      }
    }

    return html + '\n</table>' + `
    <style>
      .ledg-export .amount {
        font-family: monospace;
      }
    </style>
    `;
  }

  if (cli_args.flags.csv || (opts && opts.csv)) {
    let width = data[0].length;
    return data.map(row => Array(width).fill('').map((x, i) => {
      let col = row[i] || '';
      return '"' + strip_ansi((typeof col == 'object' && col.pop) ?
                                 col[0].toString() :
                                 col.toString())
                     .replace(/\"/g, "\"\"") + '"';
    }).join(",")).join("\n");
  }

  let _longestWidths = Array.from(opts.minWidths);
  for (let i = 0;i < data.length;i++) {
    let row = data[i];
    for (let j = 0;j < row.length;j++) {
      if (typeof row[j] != 'object' || row[j] instanceof String)
        row[j] = [(row[j]).toString(), strip_ansi((row[j]).toString()).length];

      let realWidth = row[j][1] || strip_ansi((row[j][0] || '').toString()).length;
      _longestWidths[j] = Math.min(opts.maxWidths[j],
                                     Math.max(_longestWidths[j], realWidth));
    }
  }

  if (typeof opts.sortBody == 'number') {
    let headers = data.filter(x => x.header);
    let body = data.filter(x => !x.header)
                   .sort((a, b) => b[opts.sortBody] - a[opts.sortBody]);

    data = headers.concat(body);
  } else if (typeof opts.sortBody == 'function') {
    let headers = data.filter(x => x.header);
    let body = data.filter(x => !x.header).sort(opts.sortBody);

    data = headers.concat(body);
  }

  let content = '';

  for (let i = 0;i < data.length;i++) {
    let row = data[i];
    let rowData = '';
    for (let j = 0;j < row.length;j++) {
      let col = row[j][0];

      let colWidth = _longestWidths[j];
      // truncate only plaintext
      if(row[j][1] == col.length && row[j][1] > colWidth)
        col = col.substring(0, 4);
      // align
      let align = opts.align[j] || (col && col.align);
      if (row[j][1] < colWidth) {
        if (align == TAB_ALIGN_LEFT) {
          col = print_pad_right(col, colWidth, row[j][1]);
        } else if (align == TAB_ALIGN_CENTER) {
          col = print_pad_left(col, row[j][1] + Math.floor((colWidth - row[j][1]) / 2), row[j][1]);
          col = print_pad_right(col, colWidth, row[j][1]);
        } else {
          col = print_pad_left(col, colWidth, row[j][1]);
        }
      }

      if (!row.header && opts.colorizeColCallback[j])
        col = opts.colorizeColCallback[j](col, i, j);

      if (j + 1 < row.length)
        col += opts.colBorder;
      rowData += col;
    }
    if (!opts.transpose && (row.header || row.underline))
      rowData = c.underline(rowData);
    if (row.resetAlternateColor)
      alternateRowIndex = 0;
    if (opts.alternateColor)
      rowData = print_alternate_row(rowData, alternateRowIndex++);
    content += rowData + "\n";
    if (opts.rowBorder)
      content += new Array(rowData.length).fill(opts.rowBorder) + "\n";
  }

  return content;
}

class TabularHTMLNumberCell extends String {
  constructor(content) {
    super(content);
    this.htmlClass = 'amount';
  }
}

function tabulate_sortByMoney_callback(a, b, asc) {
  return b.sortBy.compare(a.sortBy) * (asc ? -1 : 1);
}

function tabulate_less(data, opts) {
  sys_log_startBuf();
  console.log(tabulate(data, opts));
  sys_log_rlsBuf();
}

var TAB_ALIGN_LEFT = 1;
var TAB_ALIGN_RIGHT = 2;
var TAB_ALIGN_CENTER = 3;
