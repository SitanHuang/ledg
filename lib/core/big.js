class Big {

  constructor(num, assign) {
    if (assign) {
      this.prim = num;
    } else if (Number.isInteger(num)) {
      this.prim = BigInt(num) * Big._SHIFT;
    } else if (!num) {
      this.prim = 0n;
    } else if (num.prim) {
      this.prim = num.prim;
    } else {
      let [ints, decis] = String(num).split(".").concat("");
      let neg = ints[0] == '-';
      this.prim = BigInt(ints + decis.padEnd(Big.DP, "0")
                                    .slice(0, Big.DP)) 
                + BigInt(decis[Big.DP] >= 5) * (neg ? -1n : 1n);
    }
  }

  static _divRound(dividend, divisor) {
    return new Big(dividend / divisor 
        + (dividend * 2n / divisor % 2n), true);
  } 

  plus(n) {
    if (typeof n.prim == 'undefined')
      n = new Big(n);
    return new Big(this.prim + n.prim, true);
  }
  minus(n) {
    if (typeof n.prim == 'undefined')
      n = new Big(n);
    return new Big(this.prim - n.prim, true);
  }
  times(n) {
    if (typeof n.prim == 'undefined')
      n = new Big(n);
    return Big._divRound(this.prim * n.prim, Big._SHIFT);
  }
  div(n) {
    if (typeof n.prim == 'undefined')
      n = new Big(n);
    return Big._divRound(this.prim * Big._SHIFT, n.prim);
  }
  eq(n) {
    return (n.prim || n) == this.prim;
  }
  round(x) {
    let dp = !isNaN(x) ? BigInt(Math.pow(10, x)) : Big._SHIFT
    return Big._divRound(this.prim * dp, dp);
  }
  valueOf() {
    let neg = this.prim < 0;
    let prim = this.prim;
    if (neg)
      prim *= -1n;
    const s = prim.toString().padStart(Big.DP+1, "0");
    return (neg ? '-' : '') + s.slice(0, -Big.DP) + ("." + s.slice(-Big.DP))
            .replace(/\.?0+$/, "");
  }
  toNumber() {
    return Number(this.valueOf());
  }
  toString() {
    return this.valueOf();
  }
}

Big.DP = 10;
Big.ZERO = new Big(0n, true);
Big._SHIFT = BigInt(Math.pow(10, Big.DP));