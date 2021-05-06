const accounting = {
  formatMoney: function (amnt, currency, precision) {
    let str = new Big(amnt).round(precision).toString().split(".");
    if (str.length == 1)
      str.push("");

    let ints = str[0];
    let neg = ints[0] == "-";
    if (neg)
      ints = ints.substring(1);
    let mod = ints.length > 3 ? ints.length % 3 : 0;

    ints = (neg ? "-" : "") + (mod ? ints.substring(0, mod) + "," : "") +
             ints.substring(mod).replace(/(\d{3})(?=\d)/g, "$1,");

    if (precision == 0)
      return ints;

    if (!precision)
      return (ints + "." + str[1]).replace(/\.?0+$/, "");

    let decs = str[1];
    decs = decs.padEnd(precision, "0");

    return (currency || "") + (ints + "." + decs);
  }
};

function accounting_numDigits(x) {
  return (Math.log10((x ^ (x >> 31)) - (x >> 31)) | 0) + 1;
}
