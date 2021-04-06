class Money {
  constructor(amt, currency=data.defaultCurrency) {
    this.amnt = new Big(amnt);
    this.currency = currency;
  }

  toString() {
    // TODO: stub
    return super.toString();
  }

  // returns primitive amnt in defaultCurrency
  valueOf() {
    return this.val();
  }

  // returns new Money obj with tCur
  convert(tCur=data.defaultCurrency) {
    if (tCur == this.currency)
      return new Money(this.amnt, tCur);

    let path = Money.resolvePath(this.currentVertex, tCur);
  }

  /*
   * performs depth-first search and return conversion rate
   */
  static resolvePath(c1, c2) {
    if (c1 == c2) return new Big(0);
    let path = graph_shortestPath(data.priceGraph, c1, c2);
    if (!path)
      throw `Cannot resolve conversion between ${c1} and ${c2}`;

  }
  return result;
}
