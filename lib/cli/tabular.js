
/*
 * `data` structure:
 * [
 *   [[text, realWidth], [text, realWidth], header: true],
 *   [[text, realWidth], [text, realWidth]],
 * ]
 */
function tabulate(data, opts) {
  if (!data.length) return;

  let def = {
    maxWidths: new Array(data[0].length).fill(Infinity),
    minWidths: new Array(data[0].length).fill(0),
    align: new Array(data[0].length).fill(TAB_ALIGN_LEFT),
    colBorder: '  ',
    rowBorder: undefined,
    alternateColor: true,
    firstRowIsHeader: true,
    colorizeColCallback: new Array(data[0].length)
  };
  Object.assign(def, opts);
  opts = def;
  
  if (cli_args.flags.csv || (opts && opts.csv)) {
    let width = data[0].length;
    return data.map(row => Array(width).fill('').map((x, i) => {
      let col = row[i] || '';
      return '"' + strip_ansi((typeof col == 'object' && col.length) ? col[0].toString() : col.toString()).trim().replace(/\"/g, "\"\"") + '"';
    }).join(",")).join("\n");
  }
  
  if (opts.firstRowIsHeader) data[0].header = true;
  
  let _longestWidths = Array.from(opts.minWidths);
  for (let i = 0;i < data.length;i++) {
    let row = data[i];
    for (let j = 0;j < row.length;j++) {
      if (typeof row[j] != 'object') {
        row[j] = [(row[j]).toString(), (row[j]).toString().length];
      }
      let realWidth = row[j][1];
      _longestWidths[j] = Math.min(opts.maxWidths[j], Math.max(_longestWidths[j], realWidth));
    }
  }
  
  let content = '';
  
  for (let i = 0;i < data.length;i++) {
    let row = data[i];
    let rowData = '';
    for (let j = 0;j < row.length;j++) {
      let col = row[j][0];
      
      let colWidth = _longestWidths[j];
      // truncate only plaintext
      if(row[j][1] == col.length && row[j][1] > colWidth) col = col.substring(0, 4);
      // align
      if (row[j][1] < colWidth) {
        if (opts.align[j] == TAB_ALIGN_LEFT) {
          col = print_pad_right(col, colWidth, row[j][1]);
        } else if (opts.align[j] == TAB_ALIGN_CENTER) {
          col = print_pad_left(col, row[j][1] + Math.floor((colWidth - row[j][1]) / 2), row[j][1]);
          col = print_pad_right(col, colWidth, row[j][1]);
        } else {
          col = print_pad_left(col, colWidth, row[j][1]);
        }
      }
      
      if (!row.header && opts.colorizeColCallback[j]) col = opts.colorizeColCallback[j](col, i, j);
      
      if (j + 1 < row.length) col += opts.colBorder;
      rowData += col;
    }
    if (row.header) rowData = c.underline(rowData);
    if (opts.alternateColor) rowData = print_alternate_row(rowData, i);
    content += rowData + "\n";
    if (opts.rowBorder) content += new Array(rowData.length).fill(opts.rowBorder) + "\n";
  }
  
  return content;
}

var TAB_ALIGN_LEFT = 1;
var TAB_ALIGN_RIGHT = 2;
var TAB_ALIGN_CENTER = 3;
