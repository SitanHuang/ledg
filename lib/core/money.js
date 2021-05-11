var MON_REGEX = /(([+-]?\d+(\.\d+)?)\s*([^\d\s,*\-.]+)|([^\d\s,*\-.]+)\s*([+-]?\d+(\.\d+)?)|([+-]?\d+(\.\d+)?))/;

class Money {
  constructor(amnt=0,
              currency=data.defaultCurrency,
              date=Math.floor(new Date() / 1000)) {
    this.amnts = {};
    this.amnts[currency] = new Big(amnt);
    this.initCur = currency;
    this.date = date;
  }

  serialize(explicit) {
    return this.toString(explicit);
  }

  toString(explicit) {
    let keys = Object.keys(this.amnts).filter(x => this.amnts[x] != 0);
    let str = [];
    for (let x of keys) {
      if (!explicit && x == data.defaultCurrency && keys.length == 1)
        return this.amnts[x].valueOf().toString();
      str.push(this.amnts[x].toNumber() + x);
    }
    return str.join(", ") || '0';
  }
  // returns primitive amnt in defaultCurrency
  valueOf() {
    return this.val(data.defaultCurrency);
  }

  val(tCur=this.initCur, date=this.date) {
    return this.convert(tCur, date).amnts[tCur].toNumber();
  }

  tryConvertArgs(args, date=this.date) {
    let cur = args.flags.currency;
    if (!cur)
      return this.clone();
    let d;
    if (args.flags['valuation-date'])
      d = Math.floor(Date.parse(args.flags['valuation-date'] + 'T00:00:00') / 1000);
    if (cur)
      try {
        return this.convert(cur, d || date);
      } catch (e) {}
    return this.clone();
  }

  // only to be called from cli
  colorFormat(dp=Big.DP, plus, pos=true) {
    let keys = Object.keys(this.amnts);
    let str = [];
    for (let x of keys) {
      if (this.amnts[x].eq(0))
        continue;

      if (x == data.defaultCurrency && keys.length == 1 &&
          !cli_args.flags['show-default-currency'])
        return Money.colorAmount('', this.amnts[x], dp, plus, pos);

      str.push(Money.colorAmount(x, this.amnts[x], dp, plus, pos));
    }
    return str.join(", ") || '0';
  }
  // only to be called from cli
  noColorFormat(dp=Big.DP, plus) {
    let keys = Object.keys(this.amnts);
    let str = [];
    for (let x of keys) {
      if (this.amnts[x].eq(0))
        continue;
      if (x == data.defaultCurrency && keys.length == 1 &&
          !cli_args.flags['show-default-currency'])
        return Money.formatAmount('', this.amnts[x], dp, plus);

      str.push(Money.formatAmount(x, this.amnts[x], dp, plus));
    }
    return str.join(", ") || '0';
  }

  static colorAmount(cur, b, maxdp=Big.DP, plus, pos) {
    let amnt = Money.formatAmount(cur, b, maxdp, plus);
    if ((pos && b < 0) || (!pos && b > 0))
      return c.redBright(amnt);
    if ((pos && b > 0) || (!pos && b < 0))
      return c.green(amnt);
    return amnt;
  }

  static formatAmount(cur, b, maxdp=Big.DP, plus) {
    // let precision = Math.min(Math.max(b.c.length - b.e - 1, 2), maxdp);
    let p = b.toString();
    let i = p.indexOf('.');
    p = i == -1 ? 0 : p.length - i - 1;
    let precision = Math.min(Math.max(p, 2), maxdp);
    if (cli_args.flags.right)
      return (plus && b > 0 ? '+' : '') +
             accounting.formatMoney(b, undefined, precision) + cur;
    return cur + (plus && b > 0 ? '+' : '') +
           accounting.formatMoney(b, undefined, precision);
  }

  clone() {
    let mon = new Money(0, data.defaultCurrency, this.date);
    for (let cur in this.amnts)
      mon.amnts[cur] = this.amnts[cur];

    return mon;
  }

  plus(mon) {
    let clone = this.clone();
    for (let cur in mon.amnts) {
      let amnt = mon.amnts[cur];
      clone.amnts[cur] = (clone.amnts[cur] || Big.ZERO).plus(amnt);
    }
    return clone;
  }

  minus(mon) {
    let clone = this.clone();
    for (let cur in mon.amnts) {
      let amnt = mon.amnts[cur];
      clone.amnts[cur] = (clone.amnts[cur] || Big.ZERO).minus(amnt);
    }
    return clone;
  }

  divPrim(x) {
    let clone = this.clone();
    for (let cur in clone.amnts) {
      clone.amnts[cur] = clone.amnts[cur].div(x);
    }
    return clone;
  }
  timesPrim(x) {
    let clone = this.clone();
    for (let cur in clone.amnts) {
      clone.amnts[cur] = clone.amnts[cur].times(x);
    }
    return clone;
  }

  /*
   * 0: if (this == b)
   * -num: if (this < b)
   * +num: if (this > b)
   */
  compare(b) {
    try {
      let iz1 = this.isZero();
      let iz2 = b.isZero();
      if (iz1 && iz2)
        return 0;

      let cur = this.initCur;
      if (iz1) { // im zero
        // find first non zero currency of b
        for (let _c in b.amnts)
          if (b.amnts[_c] && (cur = _c))
            break;
        return -b.val(cur);
      }
      // find first non zero currency of this
      for (let _c in this.amnts)
        if (this.amnts[_c] && this.amnts[_c] != 0 && (cur = _c))
          break;
      if (iz2) // b is zero
        return this.val(cur);

      return this.val(cur) - b.val(cur);
    } catch (e) {
      return 0; // uncomparable due to unresolved conversion
    }
  }

  gtr(b) {
    return this.compare(b) > 0;
  }
  gtrOrEq(b) {
    return this.compare(b) >= 0;
  }

  eq(b) {
    return !this.compare(b);
  }

  lsr(b) {
    return this.compare(b) < 0;
  }
  lsrOrEq(b) {
    return this.compare(b) <= 0;
  }

  isZero() {
    let cur;
    // find first non zero currency
    for (let _c in this.amnts)
      if (this.amnts[_c] && (cur = _c))
        break;

    if (!cur)
      return true; // this.amnts is empty or all zeroes

    // try squash into single currency
    try {
      return this.val(cur) == 0;
    } catch (e) {
      return false;
    }
  }

  // return Money with sum of all currencies in tCur
  convert(tCur=data.defaultCurrency, date=this.date) {
    let mon = new Money(0, tCur);
    for (let cur in this.amnts) {
      let amnt = this.amnts[cur];
      if (amnt.eq(0))
        continue;
      if (cur != tCur) {
        try {
          let conv = Money.resolvePath(cur, tCur, date);
          amnt = amnt.times(conv);
        } catch (e) {
          throw `Cannot convert from ${cur} to ${tCur}: ` + e;
        }
      }
      mon.amnts[tCur] = mon.amnts[tCur].plus(amnt);
    }
    //for (let cur in mon.amnts)
      // drop last digit
      // mon.amnts[cur] = mon.amnts[cur].round(Big.DP - 1);
    return mon;
  }

  removeEmpty() {
    let clone = this.clone();
    for (let cur in clone.amnts)
      if (clone.amnts[cur].eq(0))
        delete clone.amnts[cur];
    return clone;
  }

  static parseMoney(whole, date=Math.floor(new Date() / 1000)) {
    let sp = whole.split(/, ?/);
    if (!sp.length)
      return false;
    let mon;
    for (let str of sp) {
      let match = str.match(MON_REGEX);
      if (!match)
        return false;
      let cur = match[5] || match[4] || data.defaultCurrency;
      let amnt = new Big(match[6] || match[2] || match[8]);
      if (!mon)
        mon = new Money(amnt, cur, date);
      else
        mon.amnts[cur] = (mon.amnts[cur] || Big.ZERO).plus(amnt);
    }
    return mon;
  }

  /*
   * performs depth-first search and return conversion rate
   */
  static resolvePath(c1, c2, date=this.date) {
    if (c1 == c2)
      return Big.ZERO;

    let path = graph_shortestPath(data.priceGraph, c1, c2);
    if (!path)
      throw `Cannot resolve conversion between ${c1} and ${c2}`;
    let conv = new Big(1);
    for (let i = 0;i < path.length - 1;i++) {
      let r1 = path[i];
      let r2 = path[i + 1];
      let tree = data.prices[r1 + ',' + r2]; // btree history
      if (!tree)
        throw `Cannot resolve conversion between ${c1} and ${c2} because ${r1} and ${r2} cannot be resolved.`;
      let v;
      tree.walk((t, x) => {
        if (t > date)
          return true; // break loop
        v = x;
      });
      if (v != 0 && !v)
        throw `Conversion rate between ${r1} and ${r2} on ${entry_datestr(date)} cannot be resolved.`;
      conv = conv.times(v);
    }
    return conv;
  }
}
