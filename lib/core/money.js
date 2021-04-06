var MON_REGEX = /((-?[\d.]+)\s*([^\d\s,\-.]+)|([^\d\s,\-.]+)\s*(-?[\d.]+)|(-?[\d.,\-.]+))/;

class Money {
  constructor(amnt=0, currency=data.defaultCurrency, date=(new Date() / 1000 | 0)) {
    this.amnts = {};
    this.amnts[currency] = new Big(amnt);
    this.initCur = currency;
    this.date = date;
  }

  toString() {
    return Object.keys(this.amnts).sort().filter(x => this.amnts[x] != 0)
      .map(x => x == data.defaultCurrency ? this.amnts[x].valueOf() : `${x} ${this.amnts[x].toNumber()}`)
      .join(", ") || '0';
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
    for (let c in this.amnts)
      if(this.amnts[c] != 0)
        return false;
    return true;
  }

  // returns primitive amnt in defaultCurrency
  valueOf() {
    return this.val(data.defaultCurrency);
  }

  val(tCur=this.initCur, date=this.date) {
    return this.convert(tCur, date).amnts[tCur].toNumber();
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
    return mon;
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
