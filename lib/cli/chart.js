class Chart {
  constructor(min, max, data) {
    let dataSets = data[0].length;
    this.data = data;
    this.width = process.stdout.columns;
    this.height = process.stdout.rows - 10;
    this.gw = this.width - 7;
    this.gh = this.height - 3 - 2;
    this.min = min;
    this.max = max;

    let cl = this.colors = [c.bgGreen, c.bgRedBright, c.bgBlue, c.bgYellowBright, c.bgWhiteBright, c.Cyan];

    let range = this.range = Math.abs(max - min);
    let div = this.div = Math.max(this.range / this.gh, 0.01);
    let zeroRow = this.zeroRow = Math.round(max / div);

    let buffer = this.buffer = [];
    for (let i = 0;i <= this.gh + 1;i++) {
      buffer[i] = [];
      if (i == 0 || i == this.gh || i == zeroRow) this.drawYLabel(i);
      for (let j = 0;j < this.width;j++) {
        if (j == 6)
          buffer[i][j] = tree_c3;
        else
          buffer[i][j] = buffer[i][j] || ' ';
      }
    }

    let plcs = accounting_numDigits(max);
    let n = Math.pow(10, plcs - 1) / 4;
    for (let i = n;i < max;i += n) {
      let row = Math.round((max - i) / div);
      this.drawYLabel(row, i);
    }
    for (let i = -n;i > min;i -= n) {
      let row = zeroRow - Math.round((i) / div) + 1;
      this.drawYLabel(row, i);
    }
    for (let i = data.length - 1;i >= 0;i--) {
      let set = data[i];
      let col = (i * (dataSets * 2 + 1)) + 7;
      for (let j = 0;j < set.length;j++) {
        let val = set[j];
        let mxrow = 1;
        let mnrow = 0;
        if (val > 0) {
          mxrow = Math.round((max - val) / div) + 1;
          mnrow = zeroRow;
        } else if (val < 0) {
          mxrow = zeroRow + 1;
          mnrow = zeroRow - Math.round((val) / div);
        }
        for (let r = mxrow;r <= mnrow;r++) {
          buffer[r][col + j * 2] = cl[j](buffer[r][col + j * 2] );
          buffer[r][col + j * 2 + 1] = cl[j](buffer[r][col + j * 2 + 1]);
        }
      }
    }
  }

  formatNum(num) {
    const si = [
      { value: 1, symbol: "" },
      { value: 1E3, symbol: "k" },
      { value: 1E6, symbol: "M" },
      { value: 1E9, symbol: "G" },
      { value: 1E12, symbol: "T" },
      { value: 1E15, symbol: "P" },
      { value: 1E18, symbol: "E" }
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    let i;
    for (i = si.length - 1; i > 0; i--) if (num >= si[i].value) break;
    return (num / si[i].value).toFixed(2).replace(rx, "$1") + si[i].symbol;
  }

  drawYLabel(row, num) {
    num = num || (this.max - this.div * row);
    let isN = num < 0;
    if (isN) num = -num;
    let str = this.formatNum(num);
    if (isN) str = '-' + str;
    this.replace(row, 0, str.padStart(6));
  }

  replace(row, col, str, sf) {
    for (let i = 0;i < str.length;i++) {
      if (sf)
        this.buffer[row][col + i] = this.buffer[row][col + i].replace(' ', str[i]);
      else
        this.buffer[row][col + i] = str[i];
    }
  }

  render() {
    return '\n' + this.buffer
      .map((r, i) => i == this.zeroRow ? c.underline(r.join("")) : r.join("")).join("\n")
  }
}
