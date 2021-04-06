class Money {
  constructor(amt, currency=data.defaultCurrency, date=(new Date() / 1000 | 0)) {
    this.amnt = new Big(amt);
    this.currency = currency;
    this.date = date;
  }

  toString() {
    // TODO: stub
    return super.toString();
  }

  // returns primitive amnt in defaultCurrency
  valueOf() {
    return this.val();
  }

  val() {
    return this.amnt.toNumber();
  }

  // returns new Money obj with tCur
  convert(tCur=data.defaultCurrency, date=this.date) {
    if (tCur == this.currency)
      return new Money(this.amnt, tCur);

    let conv = Money.resolvePath(this.currency, tCur, date);
    return new Money(this.amnt.times(conv), tCur);
  }

  /*
   * performs depth-first search and return conversion rate
   */
  static resolvePath(c1, c2, date=this.date) {
    if (c1 == c2) return new Big(0);
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
