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
      num = num.toString();
      if (num.length <= Big.DP + 1) {
        let prim = Number(num);
        if (isNaN(prim))
          BigInt(prim); // will throw
        this.prim = BigInt(Math.round(prim * Big._SHIFT_PRIM));
      } else {
        let neg = num[0] == '-';
        let dot = num.indexOf('.');
        if (dot == -1) {
          this.prim = BigInt(num) * Big._SHIFT;
        } else {
          let dps = num.length - dot - 1;
          if (dps <= Big.DP) {
            this.prim = BigInt(num.replace('.', '').padEnd(num.length + (Big.DP - dps - 1), '0'));
          } else {
            let rd = num[dot + Big.DP + 1] >= 5 ? (neg ? -1n : 1n) : 0n;
            this.prim = BigInt(num.replace('.', '').substring(0, num.length - (dps - Big.DP) - 1))
                      + rd;
          }
        }
      }
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
    if (n == 0)
      return this.prim == 0;
    if (typeof n.prim == 'undefined')
      n = new Big(n);
    return n.prim == this.prim;
  }
  round(x) {
    let dp = !isNaN(x) ? BigInt(Math.pow(10, Big.DP - Math.min(Big.DP, x))) : Big._SHIFT;
    return this.div(dp).times(dp);
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
Big._SHIFT_PRIM = Math.pow(10, Big.DP);
