class Money {
  constructor(amnt=0, currency=data.defaultCurrency, date=(new Date() / 1000 | 0)) {
    this.amnts = {};
    this.amnts[currency] = new Big(amnt);
    this.date = date;
  }

  toString() {
    return Object.keys(this.amnts).sort().filter(x => this.amnts[x] != 0)
      .map(x => `${x} ${this.amnts[x].toNumber()}`).join(", ");
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
    for (let cur in this.amnts) {
      let amnt = this.amnts[cur] || new Big(0);
      this.amnts[cur] = amnt.plus(mon);
    }
  }

  // returns primitive amnt in defaultCurrency
  valueOf() {
    return this.val();
  }

  val(tCur=data.defaultCurrency) {
    // TODO: stub
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
