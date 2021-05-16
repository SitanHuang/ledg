class Chart {
  constructor() {
    this.buffer = [];
  }

  replace(row, col, str, sf) {
    for (let i = 0;i < str.length;i++)
      if (sf)
        this.buffer[row][col + i] = this.buffer[row][col + i].replace(' ', str[i]);
      else
        this.buffer[row][col + i] = str[i];
  }

  render() {
    return '\n' + this.buffer
      .map((r, i) => i == this.zeroRow || r.underline ? c.underline(r.join("")) : r.join(""))
      .join("\n");
  }
}
