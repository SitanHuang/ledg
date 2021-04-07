var MON_REGEX = /((-?[\d.]+)\s*([^\d\s,\-.]+)|([^\d\s,\-.]+)\s*(-?[\d.]+)|(-?[\d.,\-.]+))/;

class Money {
  constructor(amnt=0, currency=data.defaultCurrency, date=(new Date() / 1000 | 0)) {
    this.amnts = {};
    this.amnts[currency] = new Big(amnt);
    this.initCur = currency;
    this.date = date;
  }

  toString() {
    let keys = Object.keys(this.amnts);
    let str = [];
    for (let x of keys) {
      if (this.amnts[x] == 0) continue;
      if (x == data.defaultCurrency && keys.length == 1)
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
    let d = Date.parse(args.flags['valuation-date'] + 'T00:00:00') / 1000 | 0;
    if (cur)
      try {
        return this.convert(cur, d || date);
      } catch (e) {}
    return this.clone();
  }

  // only to be called from cli
  colorFormat(dp=Big.DP) {
    let keys = Object.keys(this.amnts);
    let str = [];
    for (let x of keys) {
      if (this.amnts[x] == 0) continue;
      if (x == data.defaultCurrency && keys.length == 1) {
        return Money.colorAmount(x, this.amnts[x], dp);
      }
      str.push(Money.colorAmount(x, this.amnts[x], dp));
    }
    return str.join(", ") || '0';
  }

  static colorAmount(cur, b, maxdp=Big.DP, plus) {
    let amnt = Money.formatAmount(cur, b, maxdp);
    if (b < 0)
      return c.redBright(amnt);
    if (b > 0)
      return c.green((plus ? '+' : '') + amnt);
    return amnt;
  }

  static formatAmount(cur, b, maxdp=Big.DP, plus) {
    let precision = Math.min(Math.max(b.c.length - b.e - 1, 2), maxdp);
    return accounting.formatMoney(b, cur, precision);
  }

  serialize() {
    return this.toString();
  }

  clone() {
    let mon = new Money(0, data.defaultCurrency, this.date);
    for (let cur in this.amnts) {
      let amnt = this.amnts[cur];
      mon.amnts[cur] = amnt;
    }
    return mon;
  }

  plus(mon) {
    let clone = this.clone();
    for (let cur in mon.amnts) {
      let amnt = mon.amnts[cur];
      clone.amnts[cur] = (clone.amnts[cur] || new Big(0)).plus(amnt);
    }
    return clone;
  }
  divPrim(x) {
    let clone = this.clone();
    for (let cur in clone.amnts) {
      let amnt = clone.amnts[cur];
      clone.amnts[cur] = amnt.div(x);
    }
    return clone;
  }
  timesPrim(x) {
    let clone = this.clone();
    for (let cur in clone.amnts) {
      let amnt = clone.amnts[cur];
      clone.amnts[cur] = amnt.times(x);
    }
    return clone;
  }

  /*
   * 0: if (this == b)
   * -num: if (this < b)
   * +num: if (this > b)
   */
  compare(b) {
    let iz1 = this.isZero();
    let iz2 = b.isZero();
    if (iz1 && iz2) return 0;

    let cur;
    if (iz1) { // im zero
      // find first non zero currency of b
      for (let _c in b.amnts)
        if (b.amnts[_c] && (cur = _c)) break;
      return -b.val(cur);
    }
    // find first non zero currency of this
    for (let _c in this.amnts)
      if (this.amnts[_c] && (cur = _c)) break;
    if (iz2) { // b is zero
      return this.val(cur);
    }
    return this.val(cur) - b.val(cur);
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
      if (this.amnts[_c] && (cur = _c)) break;

    if (!cur) return true; // this.amnts is empty or all zeroes

    // try squash into single currency
    try {
      return this.val(cur) == 0;
    } catch (e) {}
    return false;
  }

  // return Money with sum of all currencies in tCur
  convert(tCur=data.defaultCurrency, date=this.date) {
    let mon = new Money(0, tCur);
    for (let cur in this.amnts) {
      let amnt = this.amnts[cur];
      if (amnt == 0) continue;
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
    for (let cur in mon.amnts) {
      // drop last digit
      mon.amnts[cur] = mon.amnts[cur].round(Big.DP - 2);
    }
    return mon;
  }

  removeEmpty() {
    let clone = this.clone();
    for (let cur in this.amnts)
      if (this.amnts[cur] == 0) delete clone.amnts[cur];
    return clone;
  }

  static parseMoney(whole, date=(new Date() / 1000 | 0)) {
    let sp = whole.split(/, ?/);
    if (!sp.length) return false;
    let mon;
    for (let str of sp) {
      let match = str.match(MON_REGEX);
      if (!match) return false;
      let cur = match[4] || match[3] || data.defaultCurrency;
      let amnt = new Big(match[5] || match[2] || match[6]);
      if (!mon)
        mon = new Money(amnt, cur, date);
      else
        mon.amnts[cur] = (mon.amnts[cur] || new Big(0)).plus(amnt);
    }
    return mon;
  }

  /*
   * performs depth-first search and return conversion rate
   */
  static resolvePath(c1, c2, date=this.date) {
    if (c1 == c2) return new Big(0);
    if (DEBUG) console.debug(`Converting ${c1} to ${c2}`);
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
      if (!v)
        throw `Conversion rate between ${r1} and ${r2} on ${entry_datestr(date)} cannot be resolved.`;
      conv = conv.times(v);
    }
    return conv;
  }
}
