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

  // returns primitive
  val(currency=this.currency) {

  }

  convert(currency=data.defaultCurrency) {

  }

}
