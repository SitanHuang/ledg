#!/usr/bin/env node
function fzy_query_account(q, accounts=Object.keys(data.accounts)) {
  if (q[0] == '!')
    return accounts.filter(a => a == q.substring(1)).sort();
  return accounts.filter(a => fzy_compare(q, a)).sort();
}

function fzy_compare(q, acc) {
  let rgx = fzy_compile(q);
  return !!acc.match(rgx);
}

function fzy_compile(q) {
  q = ("^[^.]*" + q
    .replace(/\*/g, '␞')
    .replace(/\./g, '[^.]*\\.[^.]*')
    .replace(/([a-z])/gi, '[^.]*$1[^.]*') + '[^.]*$')
    .replace(/\[\^\.\]\*\[\^\.\]\*/g, '[^.]*')
    .replace(/\[\^\.\]\*\.\*/g, '.*')
    .replace(/␞/g, '.*?');

  return new RegExp(q, 'i');
}

function isArgAccount(v) {
  let len = v.length;
  while (len--) {
    switch (v[len]) {
      case ".":
      case "*":
      case "|":
      case "$":
      case "!":
        return true;
    }
  }
  return false;
}
/*
 * desc = description of entry
 * transfers = [[desc, acc, amnt], ...]
 *  - amnt should be primative, rounded to 2 dec
 * opts = { ... }
 * balanced = pass true if already balanced
 */
function entry_create(desc, transfers, opts, balanced) {
  let e = {
    uuid: nanoid(8),
    time: Math.floor(new Date().getTime() / 1000),
    description: desc,
    transfers: transfers
  };

  Object.assign(e, opts);

  if (!balanced) {
    entry_balance(e);
  }
  return e;
}

function entry_modify_create(desc, transfers, opts, balanced) {
  let e = {};
  if (desc.trim().length)
    e.description = desc;
  Object.assign(e, opts);

  if (transfers && transfers.length) {
    e.transfers = transfers;
    if (!balanced) {
      entry_balance(e);
    }
  }

  return e;
}

function entry_balance(e) {
  let balance = entry_check_balance(e.transfers);
  if (balance && !balance.isZero()) {
    let lastAmnt = e.transfers[e.transfers.length - 1][2];
    if (lastAmnt.isZero()) // last entry auto balance
      e.transfers[e.transfers.length - 1][2] = balance;
    else
      e.transfers.push(['', data_acc_imb, balance]);
  }
}

function entry_check_balance(transfers) {
  let balance;
  for (let t of transfers) {
    if (!balance) balance = t[2];
    else balance = balance.plus(t[2]);
  }
  balance = balance.removeEmpty();
  if (balance.isZero()) return 0;
  return balance.timesPrim(-1);
}

const date_timezone_offset = new Date().getTimezoneOffset();
function date_local_iso(date=new Date()) {
  date = new Date(date * 1000 - (date_timezone_offset * 60000));
  return date.toISOString().split('T')[0];
}

function entry_datestr(entry) {
  let date = new Date((isNaN(entry) ? entry.time : entry) * 1000 - (date_timezone_offset * 60000));
  return date.toISOString().split('T')[0];
}

var tree_c0 = "├";
var tree_c1 = "─";
var tree_c2 = "└";
var tree_c3 = "│";

function expand_account(list=Object.keys(data.accounts)) {
  let data = [];
  let tree = {};
  for (let acc of list) {
    let levels = acc.split('.');
    let prnt = tree[levels[0]] || (tree[levels[0]] = {});
    for (let i = 1;i < levels.length;i++) {
      let l = levels[i];
      prnt = prnt[l] = (prnt[l] || {});
    }
  }
  
  _expand_account_subtree("", tree, data);
  return data;
}

function _expand_account_subtree(pre, t, fullList) {
  let keys = Object.keys(t);
  for (let i = 0;i < keys.length;i++) {
    fullList.push(pre + keys[i]);
    _expand_account_subtree(pre + keys[i] + '.', t[keys[i]], fullList);
  }
}

/*
 * takes in a list of accounts
 */
function print_accountTree(list) {
  let tree = {};
  let data = {list: [], fullList: [], maxLength: 0};
  list = list.sort();
  for (let acc of list) {
    let levels = acc.split('.');
    let prnt = tree[levels[0]] || (tree[levels[0]] = {});
    for (let i = 1;i < levels.length;i++) {
      let l = levels[i];
      prnt = prnt[l] = (prnt[l] || {});
    }
  }
  
  _print_accountTree_subtree("", tree, data);
  return data;
}

function _print_accountTree_subtree(pre, t, data, c3_col=[]) {
  let keys = Object.keys(t);
  for (let i = 0;i < keys.length;i++) {
    let prefix = '';
    for (let j = 0;j < c3_col.length;j++) {
      prefix += c3_col[j] ? tree_c3 + '  ' : '   ';
    }
    prefix += (i == keys.length - 1 ? tree_c2 : tree_c0);
    let row = prefix + keys[i];
    data.maxLength = Math.max(data.maxLength, row.length);
    data.list.push(row);
    data.fullList.push(pre + keys[i]);
    _print_accountTree_subtree(pre + keys[i] + '.', t[keys[i]], data, c3_col.concat([i != keys.length - 1]));
  }
}
/*
The MIT License (MIT)
=====================

Copyright © `<2020>` `Michael Mclaughlin`

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the “Software”), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.


*/

var Big;
(function (GLOBAL) {
  //var Big,
  var


/************************************** EDITABLE DEFAULTS *****************************************/


    // The default values below must be integers within the stated ranges.

    /*
     * The maximum number of decimal places (DP) of the results of operations involving division:
     * div and sqrt, and pow with negative exponents.
     */
    DP = 10,            // 0 to MAX_DP

    /*
     * The rounding mode (RM) used when rounding to the above decimal places.
     *
     *  0  Towards zero (i.e. truncate, no rounding).       (ROUND_DOWN)
     *  1  To nearest neighbour. If equidistant, round up.  (ROUND_HALF_UP)
     *  2  To nearest neighbour. If equidistant, to even.   (ROUND_HALF_EVEN)
     *  3  Away from zero.                                  (ROUND_UP)
     */
    RM = 1,             // 0, 1, 2 or 3

    // The maximum value of DP and Big.DP.
    MAX_DP = 1E6,       // 0 to 1000000

    // The maximum magnitude of the exponent argument to the pow method.
    MAX_POWER = 1E6,    // 1 to 1000000

    /*
     * The negative exponent (NE) at and beneath which toString returns exponential notation.
     * (JavaScript numbers: -7)
     * -1000000 is the minimum recommended exponent value of a Big.
     */
    NE = -7,            // 0 to -1000000

    /*
     * The positive exponent (PE) at and above which toString returns exponential notation.
     * (JavaScript numbers: 21)
     * 1000000 is the maximum recommended exponent value of a Big, but this limit is not enforced.
     */
    PE = 21,            // 0 to 1000000

    /*
     * When true, an error will be thrown if a primitive number is passed to the Big constructor,
     * or if valueOf is called, or if toNumber is called on a Big which cannot be converted to a
     * primitive number without a loss of precision.
     */
    STRICT = false,     // true or false


/**************************************************************************************************/


    // Error messages.
    NAME = '[big.js] ',
    INVALID = NAME + 'Invalid ',
    INVALID_DP = INVALID + 'decimal places',
    INVALID_RM = INVALID + 'rounding mode',
    DIV_BY_ZERO = NAME + 'Division by zero',

    // The shared prototype object.
    P = {},
    UNDEFINED = void 0,
    NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;


  /*
   * Create and return a Big constructor.
   */
  function _Big_() {

    /*
     * The Big constructor and exported function.
     * Create and return a new instance of a Big number object.
     *
     * n {number|string|Big} A numeric value.
     */
    function Big(n) {
      var x = this;

      // Enable constructor usage without new.
      if (!(x instanceof Big)) return n === UNDEFINED ? _Big_() : new Big(n);

      // Duplicate.
      if (n instanceof Big) {
        x.s = n.s;
        x.e = n.e;
        x.c = n.c.slice();
      } else {
        if (typeof n !== 'string') {
          if (Big.strict === true) {
            throw TypeError(INVALID + 'number');
          }

          // Minus zero?
          n = n === 0 && 1 / n < 0 ? '-0' : String(n);
        }

        parse(x, n);
      }

      // Retain a reference to this Big constructor.
      // Shadow Big.prototype.constructor which points to Object.
      x.constructor = Big;
    }

    Big.prototype = P;
    Big.DP = DP;
    Big.RM = RM;
    Big.NE = NE;
    Big.PE = PE;
    Big.strict = STRICT;

    return Big;
  }


  /*
   * Parse the number or string value passed to a Big constructor.
   *
   * x {Big} A Big number instance.
   * n {number|string} A numeric value.
   */
  function parse(x, n) {
    var e, i, nl;

    if (!NUMERIC.test(n)) {
      throw Error(INVALID + 'number');
    }

    // Determine sign.
    x.s = n.charAt(0) == '-' ? (n = n.slice(1), -1) : 1;

    // Decimal point?
    if ((e = n.indexOf('.')) > -1) n = n.replace('.', '');

    // Exponential form?
    if ((i = n.search(/e/i)) > 0) {

      // Determine exponent.
      if (e < 0) e = i;
      e += +n.slice(i + 1);
      n = n.substring(0, i);
    } else if (e < 0) {

      // Integer.
      e = n.length;
    }

    nl = n.length;

    // Determine leading zeros.
    for (i = 0; i < nl && n.charAt(i) == '0';) ++i;

    if (i == nl) {

      // Zero.
      x.c = [x.e = 0];
    } else {

      // Determine trailing zeros.
      for (; nl > 0 && n.charAt(--nl) == '0';);
      x.e = e - i - 1;
      x.c = [];

      // Convert string to array of digits without leading/trailing zeros.
      for (e = 0; i <= nl;) x.c[e++] = +n.charAt(i++);
    }

    return x;
  }


  /*
   * Round Big x to a maximum of sd significant digits using rounding mode rm.
   *
   * x {Big} The Big to round.
   * sd {number} Significant digits: integer, 0 to MAX_DP inclusive.
   * rm {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
   * [more] {boolean} Whether the result of division was truncated.
   */
  function round(x, sd, rm, more) {
    var xc = x.c;

    if (rm === UNDEFINED) rm = Big.RM;
    if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) {
      throw Error(INVALID_RM);
    }

    if (sd < 1) {
      more =
        rm === 3 && (more || !!xc[0]) || sd === 0 && (
        rm === 1 && xc[0] >= 5 ||
        rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED))
      );

      xc.length = 1;

      if (more) {

        // 1, 0.1, 0.01, 0.001, 0.0001 etc.
        x.e = x.e - sd + 1;
        xc[0] = 1;
      } else {

        // Zero.
        xc[0] = x.e = 0;
      }
    } else if (sd < xc.length) {

      // xc[sd] is the digit after the digit that may be rounded up.
      more =
        rm === 1 && xc[sd] >= 5 ||
        rm === 2 && (xc[sd] > 5 || xc[sd] === 5 &&
          (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) ||
        rm === 3 && (more || !!xc[0]);

      // Remove any digits after the required precision.
      xc.length = sd--;

      // Round up?
      if (more) {

        // Rounding up may mean the previous digit has to be rounded up.
        for (; ++xc[sd] > 9;) {
          xc[sd] = 0;
          if (!sd--) {
            ++x.e;
            xc.unshift(1);
          }
        }
      }

      // Remove trailing zeros.
      for (sd = xc.length; !xc[--sd];) xc.pop();
    }

    return x;
  }


  /*
   * Return a string representing the value of Big x in normal or exponential notation.
   * Handles P.toExponential, P.toFixed, P.toJSON, P.toPrecision, P.toString and P.valueOf.
   */
  function stringify(x, doExponential, isNonzero) {
    var e = x.e,
      s = x.c.join(''),
      n = s.length;

    // Exponential notation?
    if (doExponential) {
      s = s.charAt(0) + (n > 1 ? '.' + s.slice(1) : '') + (e < 0 ? 'e' : 'e+') + e;

    // Normal notation.
    } else if (e < 0) {
      for (; ++e;) s = '0' + s;
      s = '0.' + s;
    } else if (e > 0) {
      if (++e > n) {
        for (e -= n; e--;) s += '0';
      } else if (e < n) {
        s = s.slice(0, e) + '.' + s.slice(e);
      }
    } else if (n > 1) {
      s = s.charAt(0) + '.' + s.slice(1);
    }

    return x.s < 0 && isNonzero ? '-' + s : s;
  }


  // Prototype/instance methods


  /*
   * Return a new Big whose value is the absolute value of this Big.
   */
  P.abs = function () {
    var x = new this.constructor(this);
    x.s = 1;
    return x;
  };


  /*
   * Return 1 if the value of this Big is greater than the value of Big y,
   *       -1 if the value of this Big is less than the value of Big y, or
   *        0 if they have the same value.
   */
  P.cmp = function (y) {
    var isneg,
      x = this,
      xc = x.c,
      yc = (y = new x.constructor(y)).c,
      i = x.s,
      j = y.s,
      k = x.e,
      l = y.e;

    // Either zero?
    if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;

    // Signs differ?
    if (i != j) return i;

    isneg = i < 0;

    // Compare exponents.
    if (k != l) return k > l ^ isneg ? 1 : -1;

    j = (k = xc.length) < (l = yc.length) ? k : l;

    // Compare digit by digit.
    for (i = -1; ++i < j;) {
      if (xc[i] != yc[i]) return xc[i] > yc[i] ^ isneg ? 1 : -1;
    }

    // Compare lengths.
    return k == l ? 0 : k > l ^ isneg ? 1 : -1;
  };


  /*
   * Return a new Big whose value is the value of this Big divided by the value of Big y, rounded,
   * if necessary, to a maximum of Big.DP decimal places using rounding mode Big.RM.
   */
  P.div = function (y) {
    var x = this,
      Big = x.constructor,
      a = x.c,                  // dividend
      b = (y = new Big(y)).c,   // divisor
      k = x.s == y.s ? 1 : -1,
      dp = Big.DP;

    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }

    // Divisor is zero?
    if (!b[0]) {
      throw Error(DIV_BY_ZERO);
    }

    // Dividend is 0? Return +-0.
    if (!a[0]) {
      y.s = k;
      y.c = [y.e = 0];
      return y;
    }

    var bl, bt, n, cmp, ri,
      bz = b.slice(),
      ai = bl = b.length,
      al = a.length,
      r = a.slice(0, bl),   // remainder
      rl = r.length,
      q = y,                // quotient
      qc = q.c = [],
      qi = 0,
      p = dp + (q.e = x.e - y.e) + 1;    // precision of the result

    q.s = k;
    k = p < 0 ? 0 : p;

    // Create version of divisor with leading zero.
    bz.unshift(0);

    // Add zeros to make remainder as long as divisor.
    for (; rl++ < bl;) r.push(0);

    do {

      // n is how many times the divisor goes into current remainder.
      for (n = 0; n < 10; n++) {

        // Compare divisor and remainder.
        if (bl != (rl = r.length)) {
          cmp = bl > rl ? 1 : -1;
        } else {
          for (ri = -1, cmp = 0; ++ri < bl;) {
            if (b[ri] != r[ri]) {
              cmp = b[ri] > r[ri] ? 1 : -1;
              break;
            }
          }
        }

        // If divisor < remainder, subtract divisor from remainder.
        if (cmp < 0) {

          // Remainder can't be more than 1 digit longer than divisor.
          // Equalise lengths using divisor with extra leading zero?
          for (bt = rl == bl ? b : bz; rl;) {
            if (r[--rl] < bt[rl]) {
              ri = rl;
              for (; ri && !r[--ri];) r[ri] = 9;
              --r[ri];
              r[rl] += 10;
            }
            r[rl] -= bt[rl];
          }

          for (; !r[0];) r.shift();
        } else {
          break;
        }
      }

      // Add the digit n to the result array.
      qc[qi++] = cmp ? n : ++n;

      // Update the remainder.
      if (r[0] && cmp) r[rl] = a[ai] || 0;
      else r = [a[ai]];

    } while ((ai++ < al || r[0] !== UNDEFINED) && k--);

    // Leading zero? Do not remove if result is simply zero (qi == 1).
    if (!qc[0] && qi != 1) {

      // There can't be more than one zero.
      qc.shift();
      q.e--;
      p--;
    }

    // Round?
    if (qi > p) round(q, p, Big.RM, r[0] !== UNDEFINED);

    return q;
  };


  /*
   * Return true if the value of this Big is equal to the value of Big y, otherwise return false.
   */
  P.eq = function (y) {
    return this.cmp(y) === 0;
  };


  /*
   * Return true if the value of this Big is greater than the value of Big y, otherwise return
   * false.
   */
  P.gt = function (y) {
    return this.cmp(y) > 0;
  };


  /*
   * Return true if the value of this Big is greater than or equal to the value of Big y, otherwise
   * return false.
   */
  P.gte = function (y) {
    return this.cmp(y) > -1;
  };


  /*
   * Return true if the value of this Big is less than the value of Big y, otherwise return false.
   */
  P.lt = function (y) {
    return this.cmp(y) < 0;
  };


  /*
   * Return true if the value of this Big is less than or equal to the value of Big y, otherwise
   * return false.
   */
  P.lte = function (y) {
    return this.cmp(y) < 1;
  };


  /*
   * Return a new Big whose value is the value of this Big minus the value of Big y.
   */
  P.minus = P.sub = function (y) {
    var i, j, t, xlty,
      x = this,
      Big = x.constructor,
      a = x.s,
      b = (y = new Big(y)).s;

    // Signs differ?
    if (a != b) {
      y.s = -b;
      return x.plus(y);
    }

    var xc = x.c.slice(),
      xe = x.e,
      yc = y.c,
      ye = y.e;

    // Either zero?
    if (!xc[0] || !yc[0]) {
      if (yc[0]) {
        y.s = -b;
      } else if (xc[0]) {
        y = new Big(x);
      } else {
        y.s = 1;
      }
      return y;
    }

    // Determine which is the bigger number. Prepend zeros to equalise exponents.
    if (a = xe - ye) {

      if (xlty = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye = xe;
        t = yc;
      }

      t.reverse();
      for (b = a; b--;) t.push(0);
      t.reverse();
    } else {

      // Exponents equal. Check digit by digit.
      j = ((xlty = xc.length < yc.length) ? xc : yc).length;

      for (a = b = 0; b < j; b++) {
        if (xc[b] != yc[b]) {
          xlty = xc[b] < yc[b];
          break;
        }
      }
    }

    // x < y? Point xc to the array of the bigger number.
    if (xlty) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }

    /*
     * Append zeros to xc if shorter. No need to add zeros to yc if shorter as subtraction only
     * needs to start at yc.length.
     */
    if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--;) xc[i++] = 0;

    // Subtract yc from xc.
    for (b = i; j > a;) {
      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i];) xc[i] = 9;
        --xc[i];
        xc[j] += 10;
      }

      xc[j] -= yc[j];
    }

    // Remove trailing zeros.
    for (; xc[--b] === 0;) xc.pop();

    // Remove leading zeros and adjust exponent accordingly.
    for (; xc[0] === 0;) {
      xc.shift();
      --ye;
    }

    if (!xc[0]) {

      // n - n = +0
      y.s = 1;

      // Result must be zero.
      xc = [ye = 0];
    }

    y.c = xc;
    y.e = ye;

    return y;
  };


  /*
   * Return a new Big whose value is the value of this Big modulo the value of Big y.
   */
  P.mod = function (y) {
    var ygtx,
      x = this,
      Big = x.constructor,
      a = x.s,
      b = (y = new Big(y)).s;

    if (!y.c[0]) {
      throw Error(DIV_BY_ZERO);
    }

    x.s = y.s = 1;
    ygtx = y.cmp(x) == 1;
    x.s = a;
    y.s = b;

    if (ygtx) return new Big(x);

    a = Big.DP;
    b = Big.RM;
    Big.DP = Big.RM = 0;
    x = x.div(y);
    Big.DP = a;
    Big.RM = b;

    return this.minus(x.times(y));
  };


  /*
   * Return a new Big whose value is the value of this Big plus the value of Big y.
   */
  P.plus = P.add = function (y) {
    var e, k, t,
      x = this,
      Big = x.constructor;

    y = new Big(y);

    // Signs differ?
    if (x.s != y.s) {
      y.s = -y.s;
      return x.minus(y);
    }

    var xe = x.e,
      xc = x.c,
      ye = y.e,
      yc = y.c;

    // Either zero?
    if (!xc[0] || !yc[0]) {
      if (!yc[0]) {
        if (xc[0]) {
          y = new Big(x);
        } else {
          y.s = x.s;
        }
      }
      return y;
    }

    xc = xc.slice();

    // Prepend zeros to equalise exponents.
    // Note: reverse faster than unshifts.
    if (e = xe - ye) {
      if (e > 0) {
        ye = xe;
        t = yc;
      } else {
        e = -e;
        t = xc;
      }

      t.reverse();
      for (; e--;) t.push(0);
      t.reverse();
    }

    // Point xc to the longer array.
    if (xc.length - yc.length < 0) {
      t = yc;
      yc = xc;
      xc = t;
    }

    e = yc.length;

    // Only start adding at yc.length - 1 as the further digits of xc can be left as they are.
    for (k = 0; e; xc[e] %= 10) k = (xc[--e] = xc[e] + yc[e] + k) / 10 | 0;

    // No need to check for zero, as +x + +y != 0 && -x + -y != 0

    if (k) {
      xc.unshift(k);
      ++ye;
    }

    // Remove trailing zeros.
    for (e = xc.length; xc[--e] === 0;) xc.pop();

    y.c = xc;
    y.e = ye;

    return y;
  };


  /*
   * Return a Big whose value is the value of this Big raised to the power n.
   * If n is negative, round to a maximum of Big.DP decimal places using rounding
   * mode Big.RM.
   *
   * n {number} Integer, -MAX_POWER to MAX_POWER inclusive.
   */
  P.pow = function (n) {
    var x = this,
      one = new x.constructor('1'),
      y = one,
      isneg = n < 0;

    if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
      throw Error(INVALID + 'exponent');
    }

    if (isneg) n = -n;

    for (;;) {
      if (n & 1) y = y.times(x);
      n >>= 1;
      if (!n) break;
      x = x.times(x);
    }

    return isneg ? one.div(y) : y;
  };


  /*
   * Return a new Big whose value is the value of this Big rounded to a maximum precision of sd
   * significant digits using rounding mode rm, or Big.RM if rm is not specified.
   *
   * sd {number} Significant digits: integer, 1 to MAX_DP inclusive.
   * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
   */
  P.prec = function (sd, rm) {
    if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
      throw Error(INVALID + 'precision');
    }
    return round(new this.constructor(this), sd, rm);
  };


  /*
   * Return a new Big whose value is the value of this Big rounded to a maximum of dp decimal places
   * using rounding mode rm, or Big.RM if rm is not specified.
   * If dp is negative, round to an integer which is a multiple of 10**-dp.
   * If dp is not specified, round to 0 decimal places.
   *
   * dp? {number} Integer, -MAX_DP to MAX_DP inclusive.
   * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
   */
  P.round = function (dp, rm) {
    if (dp === UNDEFINED) dp = 0;
    else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    return round(new this.constructor(this), dp + this.e + 1, rm);
  };


  /*
   * Return a new Big whose value is the square root of the value of this Big, rounded, if
   * necessary, to a maximum of Big.DP decimal places using rounding mode Big.RM.
   */
  P.sqrt = function () {
    var r, c, t,
      x = this,
      Big = x.constructor,
      s = x.s,
      e = x.e,
      half = new Big('0.5');

    // Zero?
    if (!x.c[0]) return new Big(x);

    // Negative?
    if (s < 0) {
      throw Error(NAME + 'No square root');
    }

    // Estimate.
    s = Math.sqrt(x + '');

    // Math.sqrt underflow/overflow?
    // Re-estimate: pass x coefficient to Math.sqrt as integer, then adjust the result exponent.
    if (s === 0 || s === 1 / 0) {
      c = x.c.join('');
      if (!(c.length + e & 1)) c += '0';
      s = Math.sqrt(c);
      e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
      r = new Big((s == 1 / 0 ? '5e' : (s = s.toExponential()).slice(0, s.indexOf('e') + 1)) + e);
    } else {
      r = new Big(s + '');
    }

    e = r.e + (Big.DP += 4);

    // Newton-Raphson iteration.
    do {
      t = r;
      r = half.times(t.plus(x.div(t)));
    } while (t.c.slice(0, e).join('') !== r.c.slice(0, e).join(''));

    return round(r, (Big.DP -= 4) + r.e + 1, Big.RM);
  };


  /*
   * Return a new Big whose value is the value of this Big times the value of Big y.
   */
  P.times = P.mul = function (y) {
    var c,
      x = this,
      Big = x.constructor,
      xc = x.c,
      yc = (y = new Big(y)).c,
      a = xc.length,
      b = yc.length,
      i = x.e,
      j = y.e;

    // Determine sign of result.
    y.s = x.s == y.s ? 1 : -1;

    // Return signed 0 if either 0.
    if (!xc[0] || !yc[0]) {
      y.c = [y.e = 0];
      return y;
    }

    // Initialise exponent of result as x.e + y.e.
    y.e = i + j;

    // If array xc has fewer digits than yc, swap xc and yc, and lengths.
    if (a < b) {
      c = xc;
      xc = yc;
      yc = c;
      j = a;
      a = b;
      b = j;
    }

    // Initialise coefficient array of result with zeros.
    for (c = new Array(j = a + b); j--;) c[j] = 0;

    // Multiply.

    // i is initially xc.length.
    for (i = b; i--;) {
      b = 0;

      // a is yc.length.
      for (j = a + i; j > i;) {

        // Current sum of products at this digit position, plus carry.
        b = c[j] + yc[i] * xc[j - i - 1] + b;
        c[j--] = b % 10;

        // carry
        b = b / 10 | 0;
      }

      c[j] = b;
    }

    // Increment result exponent if there is a final carry, otherwise remove leading zero.
    if (b) ++y.e;
    else c.shift();

    // Remove trailing zeros.
    for (i = c.length; !c[--i];) c.pop();
    y.c = c;

    return y;
  };


  /*
   * Return a string representing the value of this Big in exponential notation rounded to dp fixed
   * decimal places using rounding mode rm, or Big.RM if rm is not specified.
   *
   * dp? {number} Decimal places: integer, 0 to MAX_DP inclusive.
   * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
   */
  P.toExponential = function (dp, rm) {
    var x = this,
      n = x.c[0];

    if (dp !== UNDEFINED) {
      if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
        throw Error(INVALID_DP);
      }
      x = round(new x.constructor(x), ++dp, rm);
      for (; x.c.length < dp;) x.c.push(0);
    }

    return stringify(x, true, !!n);
  };


  /*
   * Return a string representing the value of this Big in normal notation rounded to dp fixed
   * decimal places using rounding mode rm, or Big.RM if rm is not specified.
   *
   * dp? {number} Decimal places: integer, 0 to MAX_DP inclusive.
   * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
   *
   * (-0).toFixed(0) is '0', but (-0.1).toFixed(0) is '-0'.
   * (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
   */
  P.toFixed = function (dp, rm) {
    var x = this,
      n = x.c[0];

    if (dp !== UNDEFINED) {
      if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
        throw Error(INVALID_DP);
      }
      x = round(new x.constructor(x), dp + x.e + 1, rm);

      // x.e may have changed if the value is rounded up.
      for (dp = dp + x.e + 1; x.c.length < dp;) x.c.push(0);
    }

    return stringify(x, false, !!n);
  };


  /*
   * Return a string representing the value of this Big.
   * Return exponential notation if this Big has a positive exponent equal to or greater than
   * Big.PE, or a negative exponent equal to or less than Big.NE.
   * Omit the sign for negative zero.
   */
  P.toJSON = P.toString = function () {
    var x = this,
      Big = x.constructor;
    return stringify(x, x.e <= Big.NE || x.e >= Big.PE, !!x.c[0]);
  };


  /*
   * Return the value of this Big as a primitve number.
   */
  P.toNumber = function () {
    var n = Number(stringify(this, true, true));
    if (this.constructor.strict === true && !this.eq(n.toString())) {
      throw Error(NAME + 'Imprecise conversion');
    }
    return n;
  };


  /*
   * Return a string representing the value of this Big rounded to sd significant digits using
   * rounding mode rm, or Big.RM if rm is not specified.
   * Use exponential notation if sd is less than the number of digits necessary to represent
   * the integer part of the value in normal notation.
   *
   * sd {number} Significant digits: integer, 1 to MAX_DP inclusive.
   * rm? {number} Rounding mode: 0 (down), 1 (half-up), 2 (half-even) or 3 (up).
   */
  P.toPrecision = function (sd, rm) {
    var x = this,
      Big = x.constructor,
      n = x.c[0];

    if (sd !== UNDEFINED) {
      if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
        throw Error(INVALID + 'precision');
      }
      x = round(new Big(x), sd, rm);
      for (; x.c.length < sd;) x.c.push(0);
    }

    return stringify(x, sd <= x.e || x.e <= Big.NE || x.e >= Big.PE, !!n);
  };


  /*
   * Return a string representing the value of this Big.
   * Return exponential notation if this Big has a positive exponent equal to or greater than
   * Big.PE, or a negative exponent equal to or less than Big.NE.
   * Include the sign for negative zero.
   */
  P.valueOf = function () {
    var x = this,
      Big = x.constructor;
    if (Big.strict === true) {
      throw Error(NAME + 'valueOf disallowed');
    }
    return stringify(x, x.e <= Big.NE || x.e >= Big.PE, true);
  };


  // Export


  Big = _Big_();

  Big['default'] = Big.Big = Big;

//   AMD.
//   if (typeof define === 'function' && define.amd) {
//     define(function () { return Big; });
//
//   Node and other CommonJS-like environments that support module.exports.
//   } else if (typeof module !== 'undefined' && module.exports) {
//     module.exports = Big;
//
//   Browser.
//   } else {
//     GLOBAL.Big = Big;
//   }
})(this);
var cmd_report_modifiers = {
  from: "@year-start", // inclusive
  to: "@year-end", // exclusive
};

var cmd_report_accounts = {
  income: 'Income*',
  expense: 'Expense*',
  asset: 'Asset*',
  liability: 'Liability*',
  equity: 'Equity*'
};

var cmd_report_accounts_compiled = {};

function report_set_accounts(args) {
  Object.keys(cmd_report_accounts).forEach(x => {
    cmd_report_accounts[x] = args.flags[x] || cmd_report_accounts[x];
  });
}

function report_compile_account_regex() {
  Object.keys(cmd_report_accounts).forEach(x => {
    cmd_report_accounts_compiled[x] = fzy_compile(cmd_report_accounts[x]);
  });
}

function report_set_modifiers(args) {
  Object.keys(cmd_report_modifiers).forEach(x => {
    cmd_report_modifiers[x] = args.modifiers[x] || cmd_report_modifiers[x];
  });
}

function report_get_reporting_interval(args, rtnNull) {
  // adds to new Date(y, m, d)
  // default: monthly
  let def = [0, 1, 0];

  if (args.flags.yearly) def = [1, 0, 0];
  else if (args.flags.quarterly) def = [0, 3, 0];
  else if (args.flags.monthly) def = [0, 1, 0];
  else if (args.flags.biweekly) def = [0, 0, 14];
  else if (args.flags.weekly) def = [0, 0, 7];
  else if (args.flags.daily) def = [0, 0, 1];
  else if (rtnNull) return;

  return def;
}

function report_sort_by_time(entries) {
  return entries = entries.sort((a, b) => a.time - b.time);
}

function report_extract_account(args) {
  args.accounts = args.accounts || [];
  args.accountSrc = args.accountSrc || [];
  let v = args._;
  for (let i = 0;i < v.length;i++) {
    if (isArgAccount(v[i])) {
      args.accounts.push(fzy_compile(v[i]));
      args.accountSrc.push(v[i]);
      v.splice(i, 1);
      i--;
    }
  }
}

function report_extract_tags(args) {
  if (args.modifiers.tags) return;
  let tags = [];
  let v = args._;
  for (let i = 0;i < v.length;i++) {
    if (v[i].startsWith('+')) {
      tags.push(v[i].substring(1));
      v.splice(i, 1);
      i--;
    }
  }
  if (!tags.length) return;
  args.modifiers.tags = tags.join("(,|$)|") + "(,|$)";
}

var CMD_MODIFER_REPLACE = {
  "@year-start": () => new Date(new Date().getFullYear(), 0, 1) / 1000 | 0,
  "@min": () => fs_data_range.length ? (Date.parse(fs_data_range[0] + '-01-01T00:00:00') / 1000 | 0) : 0,
  "@max": () => (fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000) / 1000 | 0,
  "@year-end": () => new Date(new Date().getFullYear() + 1, 0, 1) / 1000 | 0,
  "@month-start": () => new Date(new Date().getFullYear(), new Date().getMonth(), 1) / 1000 | 0,
  "@month-end": () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) / 1000 | 0,
  "@today": () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0) / 1000 | 0,
  "@tomorrow": () => new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 0, 0, 0, 0) / 1000 | 0,
  "@last-year-today": () => {
    let a = new Date();
    a.setFullYear(a.getFullYear() - 1);
    return a / 1000 | 0;
  },
  "@last-year": () => new Date(new Date().getFullYear() - 1, 0, 1) / 1000 | 0
};

/*
 * IMPORTANT: callback must be async
 */
async function report_traverse(args, callback, afterOpenCallback) {
  let min_f = fs_data_range.length ? Date.parse(fs_data_range[0] + '-01-01T00:00:00') : 0;
  let f = Date.parse(report_replaceDateStr(cmd_report_modifiers.from) + 'T00:00:00') || min_f;
  let max_t = fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000;
  let t = Date.parse(report_replaceDateStr(cmd_report_modifiers.to) + 'T00:00:00') - 1000 || max_t;
  let range = data_books_required(f, t);
  let ignored = Object.keys(cmd_report_modifiers);

  let regexMod = {};
  for (mod in args.modifiers) {
    if (ignored.indexOf(mod) >= 0) continue;
    if (args.modifiers[mod]) regexMod[mod] = new RegExp(args.modifiers[mod], 'i');
  }

  await data_iterate_books(range, async function (book) {
    let len = book.length;
    WHILE: while (len--) {
      let entry = book[len];
      if ((entry.time >= (f / 1000 | 0)) && (entry.time < t / 1000 | 0)) {
        if (entry.virt && args.flags.real) continue WHILE;
        if (args.flags['skip-book-close'] && entry.bookClose && entry.bookClose.toString() == 'true') continue WHILE;
        if (args.accounts && args.accounts.length) {
          let matchTimes = 0;
          FOR: for (let q of args.accounts) {
            for (let t of entry.transfers) {
              if (t[1].match(q)) {
                matchTimes++;
                break;
              }
            }
          }
          if (matchTimes != args.accounts.length) continue WHILE;
        }
        for (mod in regexMod) {
          if (!entry[mod]) {
            if (regexMod[mod].source == '(?:)') continue; // empty on both
            else continue WHILE;
          }
          if (!(entry[mod].toString()).match(regexMod[mod])) continue WHILE;
        }
        await callback(entry);
      }
    }
  }, afterOpenCallback);
}

async function report_sum_accounts(args, sum_parent, forkAccList) {
  cmd_report_modifiers.from = args.modifiers.from; // unless specified, query everything
  cmd_report_modifiers.to = args.modifiers.to;

  let d;
  await report_traverse(args, async function(entry) {
    for (let t of entry.transfers) {
      if (sum_parent) {
        let levels = t[1].split(".");
        let previous = "";
        for (let l of levels) {
          let k = previous + l;
          if (!d[k]) d[k] = new Money();
          d[k] = d[k].plus(t[2]);
          previous = k + ".";
        }
      } else {
        d[t[1]] = d[t[1]].plus(t[2]);
      }
    }
  }, async function() { // wait until books are opened to load accounts

    d = JSON.parse(JSON.stringify(forkAccList || data.accounts));
    Object.keys(d).forEach(x => d[x] = new Money());
  });

  Object.keys(d).forEach(x => {
    if (args.accounts && args.accounts) {
      let matchTimes = 0;
      for (let q of args.accounts) {
        if (x.match(q)) {
          matchTimes++;
          break;
        }
      }
      if (matchTimes != args.accounts.length)
        delete d[x];
    }
  });
  return d;
}

function report_replaceDateStr(dateStr) {
  if (CMD_MODIFER_REPLACE[dateStr]) return new Date(CMD_MODIFER_REPLACE[dateStr]() * 1000).toISOString().split('T')[0];
  return dateStr;
}
var MON_REGEX = /((-?[\d.]+)\s*([^\d\s,\-.]+)|([^\d\s,\-.]+)\s*(-?[\d.]+)|(-?[\d.,\-.]+))/;

class Money {
  constructor(amnt=0, currency=data.defaultCurrency, date=(new Date() / 1000 | 0)) {
    this.amnts = {};
    this.amnts[currency] = new Big(amnt);
    this.initCur = currency;
    this.date = date;
  }

  serialize() {
    return this.toString();
  }

  toString() {
    let keys = Object.keys(this.amnts).filter(x => this.amnts[x] != 0);
    let str = [];
    for (let x of keys) {
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
  colorFormat(dp=Big.DP, plus) {
    let keys = Object.keys(this.amnts);
    let str = [];
    for (let x of keys) {
      if (this.amnts[x] == 0) continue;
      if (x == data.defaultCurrency && keys.length == 1) {
        return Money.colorAmount('', this.amnts[x], dp, plus);
      }
      str.push(Money.colorAmount(x, this.amnts[x], dp, plus));
    }
    return str.join(", ") || '0';
  }
  // only to be called from cli
  noColorFormat(dp=Big.DP, plus) {
    let keys = Object.keys(this.amnts);
    let str = [];
    for (let x of keys) {
      if (this.amnts[x] == 0) continue;
      if (x == data.defaultCurrency && keys.length == 1) {
        return Money.formatAmount('', this.amnts[x], dp, plus);
      }
      str.push(Money.formatAmount(x, this.amnts[x], dp, plus));
    }
    return str.join(", ") || '0';
  }

  static colorAmount(cur, b, maxdp=Big.DP, plus) {
    let amnt = Money.formatAmount(cur, b, maxdp, plus);
    if (b < 0)
      return c.redBright(amnt);
    if (b > 0)
      return c.green(amnt);
    return amnt;
  }

  static formatAmount(cur, b, maxdp=Big.DP, plus) {
    let precision = Math.min(Math.max(b.c.length - b.e - 1, 2), maxdp);
    return cur + (plus && b > 0 ? '+' : '') + accounting.formatMoney(b, undefined, precision);
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
    try {
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
      if (v != 0 && !v)
        throw `Conversion rate between ${r1} and ${r2} on ${entry_datestr(date)} cannot be resolved.`;
      conv = conv.times(v);
    }
    return conv;
  }
}
/*
 Copyright 2013 Daniel Wirtz <dcode@dcode.io>
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * @license btree.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Apache License, Version 2.0
 * see: http://github.com/dcodeIO/btree.js for details
 */
var BTree;
(function(module, console) {
    'use strict';

    /**
     * Concatenates multiple arrays into a new one.
     * @param {...[Array]} var_args
     * @returns {Array}
     * @private
     */
    function concat(var_args) {
        // Array#concat behaves strangely for empty arrays, so...
        var a = [];
        for (var i=0; i<arguments.length; i++) {
            Array.prototype.push.apply(a, arguments[i]);
        }
        return a;
    }

    /**
     * Searches an array for the specified value.
     * @param {Array} a
     * @param {*} v
     * @returns {number} Index or -1 if not found
     * @private
     */
    function asearch(a, v) {
        // This is faster than Array#indexOf because it's raw. However, we
        // cannot use binary search because nodes do not have a comparable
        // key. If the compiler is smart, it will inline this.
        for (var i=0; i<a.length; i++) {
            if (a[i] === v) return i;
        }
        return -i;
    }

    /**
     * btree namespace.
     * @type {Object.<string,*>}
     */
    var btree = {};

    /**
     * Strictly compares two strings, character by character. No locales, no number extension.
     * @param {string} a
     * @param {string} b
     * @returns {number} -1 if a < b, 1 if a > b, 0 otherwise
     * @expose
     */
    btree.strcmp = function strcmp(a, b) {
        /** @type {number} */
        var ac;
        /** @type {number} */
        var bc;
        for (var i=0; i<a.length; i++) {
            if (i >= b.length) {
                return 1;
            }
            if ((ac = a.charCodeAt(i)) < (bc = b.charCodeAt(i))) {
                return -1;
            } else if (ac > bc) {
                return 1;
            }
            // If same, continue
        }
        return a.length == b.length ? 0 : -1;
    };

    /**
     * Compares two numbers.
     * @param {number} a
     * @param {number} b
     * @returns {number} -1 if a < b, 1 if a > b, 0 otherwise
     * @expose
     */
    btree.numcmp = function intcmp(a, b) {
        return a < b ? -1 : (a > b ? 1 : 0);
    };

    /**
     * Creates a BTree class using the given order.
     * Note that this method returns a class, not an instance.
     * @param {number=} order Defaults to 2
     * @param {function(?, ?):number=} compare Compare implementation to use on keys
     * @returns {Function}
     * @expose
     */
    btree.create = function(order, compare) {

        // Validate order
        if (typeof order == 'undefined') {
            order = 52; // Benchmarks proofed that this is close to the optimum
        } else if (typeof order == 'number') {
            order = Math.floor(order);
        } else {
            order = parseInt(order, 10);
        }
        if (order < 1) order = 1;
        var minOrder = order > 1 ? Math.floor(order/2) : 1;

        // Use numcmp by default
        if (typeof compare != 'function') {
            compare = btree.numcmp;
        }

        /**
         * Validates a node and prints debugging info if something went wrong.
         * @param {!TreeNode|!Tree} node
         * @private
         */
        function validate(node) { // This function will be stripped by the compiler
            if ((node instanceof Tree)) return;
            if (node.leaves.length+1 != node.nodes.length) {
                console.log("ERROR: Illegal leaf/node count in "+node+": "+node.leaves.length+"/"+node.nodes.length);
            }
            for (var i=0; i<node.leaves.length; i++) {
                if (!node.leaves[i]) {
                    console.log("ERROR: Illegal leaf in "+node+" at "+i+": "+node.leaves[i]);
                }
            }
            for (i=0; i<node.nodes.length; i++) {
                if (typeof node.nodes[i] == 'undefined') {
                    console.log("ERROR: Illegal node in "+node+" at "+i+": undefined");
                }
            }
        }

        /**
         * Constructs a new TreeNode.
         * @class A TreeNode.
         * @param {!(TreeNode|Tree)} parent Parent node
         * @param {Array.<!Leaf>=} leaves Leaf nodes
         * @param {Array.<TreeNode>=} nodes Child nodes
         * @constructor
         */
        var TreeNode = function(parent, leaves, nodes) {

            /**
             * Parent node.
             * @type {!TreeNode|!Tree}
             */
            this.parent = parent;

            /**
             * Leaf nodes (max. order).
             * @type {!Array.<!Leaf>}
             */
            this.leaves = leaves || [];
            this.leaves.forEach(function(leaf) {
                leaf.parent = this;
            }, this);

            /**
             * Child nodes (max. order+1).
             * @type {!Array.<TreeNode>}
             */
            this.nodes = nodes || [null];
            this.nodes.forEach(function(node) {
                if (node !== null) node.parent = this;
            }, this);
        };

        /**
         * Searches for the node that would contain the specified key.
         * @param {!*} key
         * @returns {{leaf: !Leaf, index: number}|{node: !TreeNode, index: number}} Leaf if the key exists, else the insertion node
         */
        TreeNode.prototype.search = function(key) {
            if (this.leaves.length > 0) {
                var a = this.leaves[0];
                if (compare(a.key, key) == 0) return { leaf: a, index: 0 };
                if (compare(key, a.key) < 0) {
                    if (this.nodes[0] !== null) {
                        return this.nodes[0].search(key); // Left
                    }
                    return { node: this, index: 0 }
                }
                for (var i=1; i<this.leaves.length; i++) {
                    var b = this.leaves[i];
                    if (compare(b.key, key) == 0) return { leaf: b, index: i };
                    if (compare(key, b.key) < 0) {
                        if (this.nodes[i] !== null) {
                            return this.nodes[i].search(key); // Inner
                        }
                        return { node: this, index: i };
                    }
                    a = b;
                }
                if (this.nodes[i] !== null) {
                    return this.nodes[i].search(key); // Right
                }
                return { node: this, index: i };
            }
            return { node: this, index: 0 };
        };

        /**
         * Gets the value for the given key.
         * @param {!*} key
         * @returns {*|undefined} If there is no such key, undefined is returned
         */
        TreeNode.prototype.get = function(key) {
            var result = this.search(key);
            if (result.leaf) return result.leaf.value;
            return undefined;
        };

        /**
         * Inserts a key/value pair into this node.
         * @param {!*} key
         * @param {*} value
         * @param {boolean=} overwrite Whether to overwrite existing values, defaults to `true`
         * @returns {boolean} true if successfully set, false if already present and overwrite is `false`
         */
        TreeNode.prototype.put = function(key, value, overwrite) {
            var result = this.search(key);
            if (result.leaf) {
                if (typeof overwrite !== 'undefined' && !overwrite) {
                    return false;
                }
                result.leaf.value = value;
                return true;
            } // Key already exists
            var node = result.node,
                index = result.index;
            node.leaves.splice(index, 0, new Leaf(node, key, value));
            node.nodes.splice(index+1, 0, null);
            if (node.leaves.length > order) { // Rebalance
                node.split();
            }
            return true;
        };

        /**
         * Deletes a key from this node.
         * @param {!*} key
         * @returns {boolean} true if the key has been deleted, false if the key does not exist
         */
        TreeNode.prototype.del = function(key) {
            var result = this.search(key);
            if (!result.leaf) return false;
            var leaf = result.leaf,
                node = leaf.parent,
                index = result.index,
                left = node.nodes[index];
            if (left === null) {
                node.leaves.splice(index, 1);
                node.nodes.splice(index, 1);
                node.balance();
            } else {
                var max = left.leaves[left.leaves.length-1];
                left.del(max.key);
                max.parent = node;
                node.leaves.splice(index, 1, max);
            }
            return true;
        };

        /**
         * Balances this node to fulfill all conditions.
         */
        TreeNode.prototype.balance = function() {
            if (this.parent instanceof Tree) {
                // Special case: Root has just a single child and no leaves
                if (this.leaves.length == 0 && this.nodes[0] !== null) {
                    this.parent.root = this.nodes[0];
                    this.parent.root.parent = this.parent;
                }
                return;
            }
            if (this.leaves.length >= minOrder) {
                return;
            }
            var index = asearch(this.parent.nodes, this),
                left = index > 0 ? this.parent.nodes[index-1] : null,
                right = this.parent.nodes.length > index+1 ? this.parent.nodes[index+1] : null;
            var sep, leaf, rest;
            if (right !== null && right.leaves.length > minOrder) {
                // Append the seperator from parent to this
                sep = this.parent.leaves[index];
                sep.parent = this;
                this.leaves.push(sep);
                // Replace the blank with the first right leaf
                leaf = right.leaves.shift();
                leaf.parent = this.parent;
                this.parent.leaves[index] = leaf;
                // Append the right rest to this
                rest = right.nodes.shift();
                if (rest !== null) rest.parent = this;
                this.nodes.push(rest);
            } else if (left !== null && left.leaves.length > minOrder) {
                // Prepend the seperator from parent to this
                sep = this.parent.leaves[index-1];
                sep.parent = this;
                this.leaves.unshift(sep);
                // Replace the blank with the last left leaf
                leaf = left.leaves.pop();
                leaf.parent = this.parent;
                this.parent.leaves[index-1] = leaf;
                // Prepend the left rest to this
                rest = left.nodes.pop();
                if (rest !== null) rest.parent = this;
                this.nodes.unshift(rest);
            } else {
                var subst;
                if (right !== null) {
                    // Combine this + seperator from the parent + right
                    sep = this.parent.leaves[index];
                    subst = new TreeNode(this.parent, concat(this.leaves, [sep], right.leaves), concat(this.nodes, right.nodes));
                    // Remove the seperator from the parent
                    this.parent.leaves.splice(index, 1);
                    // And replace the nodes it seperated with subst
                    this.parent.nodes.splice(index, 2, subst);
                } else if (left !== null) {
                    // Combine left + seperator from parent + this
                    sep = this.parent.leaves[index-1];
                    subst = new TreeNode(this.parent, concat(left.leaves, [sep], this.leaves), concat(left.nodes, this.nodes));
                    // Remove the seperator from the parent
                    this.parent.leaves.splice(index-1, 1);
                    // And replace the nodes it seperated with subst
                    this.parent.nodes.splice(index-1, 2, subst);
                } else {
                    // We should never end here
                    throw(new Error("Internal error: "+this.toString(true)+" has neither a left nor a right sibling"));
                }
                this.parent.balance();
            }
            // validate(this);
            // validate(this.parent);
        };

        /**
         * Unsplits a child.
         * @param {!Leaf} leaf
         * @param {!TreeNode} rest
         */
        TreeNode.prototype.unsplit = function(leaf, rest) {
            leaf.parent = this;
            rest.parent = this;
            var a = this.leaves[0];
            if (compare(leaf.key, a.key) < 0) {
                this.leaves.unshift(leaf);
                this.nodes.splice(1, 0, rest);
            } else {
                for (var i=1; i<this.leaves.length; i++) {
                    var b = this.leaves[i];
                    if (compare(leaf.key, b.key) < 0) {
                        this.leaves.splice(i, 0, leaf);
                        this.nodes.splice(i+1, 0, rest);
                        break;
                    }
                }
                if (i == this.leaves.length) {
                    this.leaves.push(leaf);
                    this.nodes.push(rest);
                }
            }
            if (this.leaves.length > order) {
                this.split();
            }
        };

        /**
         * Splits this node.
         */
        TreeNode.prototype.split = function() {
            var index = Math.floor(this.leaves.length/2);
            if (this.parent instanceof Tree) {
                this.nodes = [
                    new TreeNode(this, this.leaves.slice(0, index), this.nodes.slice(0, index+1)),
                    new TreeNode(this, this.leaves.slice(index+1), this.nodes.slice(index+1))
                ];
                this.leaves = [this.leaves[index]];
            } else {
                var leaf = this.leaves[index];
                var rest = new TreeNode(this.parent, this.leaves.slice(index+1), this.nodes.slice(index+1));
                this.leaves = this.leaves.slice(0, index);
                this.nodes = this.nodes.slice(0, index+1);
                this.parent.unsplit(leaf, rest);
            }
        };

        /**
         * Returns a string representation of this node.
         * @param {boolean=} includeNodes Whether to include sub-nodes or not
         * @returns {string}
         */
        TreeNode.prototype.toString = function(includeNodes) {
            var val = [];
            for (var i=0; i<this.leaves.length; i++) {
                val.push(this.leaves[i].key);
            }
            var s = "["+val.toString()+"]"+(this.parent instanceof Tree ? ":*" : ":"+this.parent);
            if (includeNodes) {
                for (i=0; i<this.nodes.length; i++) {
                    s += " -> "+this.nodes[i];
                }
            }
            return s;
        };

        /**
         * Prints out the nodes leaves and nodes.
         * @param {number} indent
         */
        TreeNode.prototype.print = function(indent) {
            var space = ""; for (var i=0; i<indent; i++) space+=" ";
            for (i=this.leaves.length-1; i>=0; i--) {
                if (this.nodes[i+1] !== null) this.nodes[i+1].print(indent+2);
                console.log(space+this.leaves[i].key+(this.parent instanceof Tree ? "*" : ""));
            }
            if (this.nodes[0] !== null) this.nodes[0].print(indent+2);
        };

        /**
         * Constructs a new Leaf containing a value.
         * @class A Leaf.
         * @param {!TreeNode} parent
         * @param {!*} key
         * @param {*} value
         * @constructor
         */
        var Leaf = function(parent, key, value) {

            /**
             * Parent node.
             * @type {!TreeNode}
             */
            this.parent = parent;

            /**
             * Key.
             * @type {!*}
             */
            this.key = key;

            /**
             * Value.
             * @type {*}
             */
            this.value = value;
        };

        /**
         * Returns a string representation of this instance.
         * @returns {string}
         */
        Leaf.prototype.toString = function() {
            return ""+this.key;
        };

        /**
         * Constructs a new Tree.
         * @class A Tree.
         * @constructor
         */
        function Tree() {
            this.root = new TreeNode(this);
        }

        /**
         * Inserts a key/value pair into the tree.
         * @param {!*} key
         * @param {*} value
         * @param {boolean=} overwrite Whether to overwrite existing values, defaults to `true`
         * @returns {boolean} true if set, false if already present and overwrite is `false`
         * @throws {Error} If the key is undefined or null or the value is undefined
         * @expose
         */
        Tree.prototype.put = function(key, value, overwrite) {
            if (typeof key === 'undefined' || key === null)  throw(new Error("Illegal key: "+key));
            if (typeof value === 'undefined') throw(new Error("Illegal value: "+value));
            return this.root.put(key, value, overwrite);
        };

        /**
         * Gets the value of the specified key.
         * @param {!*} key
         * @returns {*|undefined} If there is no such key, undefined is returned
         * @throws {Error} If the key is undefined or null
         * @expose
         */
        Tree.prototype.get = function(key) {
            if (typeof key === 'undefined' || key === null)  throw(new Error("Illegal key: "+key));
            return this.root.get(key);
        };

        /**
         * Deletes a key from the tree.
         * @param {!*} key
         * @returns {boolean} true if the key has been deleted, false if the key does not exist
         * @expose
         */
        Tree.prototype.del = function(key) {
            if (typeof key === 'undefined' || key === null)  throw(new Error("Illegal key: "+key));
            return this.root.del(key);
        };

        /**
         * Walks through all keys [minKey, ..., maxKey] in ascending order.
         * @param {*|function(*, *):(boolean|undefined)} minKey If omitted or NULL, starts at the beginning
         * @param {(*|function(*, *):(boolean|undefined))=} maxKey If omitted or NULL, walks till the end
         * @param {function(*, *):(boolean|undefined)=} callback Callback receiving the key and the corresponding value as its
         *  parameters. May explicitly return true to stop the loop.
         * @expose
         */
        Tree.prototype.walkAsc = function(minKey, maxKey, callback) {
            if (this.root.leaves.length == 0) {
                return;
            }
            if (typeof minKey == 'function') {
                callback = minKey;
                minKey = maxKey = null;
            } else if (typeof maxKey == 'function') {
                callback = maxKey;
                maxKey = null;
            }
            minKey = typeof minKey != 'undefined' ? minKey : null;
            maxKey = typeof maxKey != 'undefined' ? maxKey : null;
            var ptr, index;
            if (minKey === null) { // If there is no minimum limit
                ptr = this.root; // set ptr to the outer left node
                while (ptr.nodes[0] !== null) {
                    ptr = ptr.nodes[0];
                }
                index = 0; // and start at its first leaf
            } else { // Else lookup
                var result = this.root.search(minKey);
                if (result.leaf) { // If the minimum key itself exists
                    ptr = result.leaf.parent; // set ptr to the containing node
                    index = asearch(ptr.leaves, result.leaf); // and start at its index
                } else { // If the key does not exist
                    ptr = result.node; // set ptr to the insertion node
                    index = result.index; // and start at the insertion index (key > minKey)
                    if (index >= ptr.leaves.length) { // on overrun, begin at the separator in the parent
                        if (ptr.parent instanceof Tree) {
                            return; // empty range
                        }
                        index = asearch(ptr.parent.nodes, ptr);
                        if (index >= ptr.parent.leaves.length) {
                            return; // empty range
                        }
                        ptr = ptr.parent;
                    }
                }
            }
            // ptr/index now points at our first result
            while (true) {
                if (maxKey !== null && compare(ptr.leaves[index].key, maxKey) > 0) {
                    break; // if there are no more keys less than maxKey
                }
                if (callback(ptr.leaves[index].key, ptr.leaves[index].value)) {
                    break; // if the user explicitly breaks the loop by returning true
                }
                if (ptr.nodes[index+1] !== null) { // Descend
                    ptr = ptr.nodes[index+1];
                    index = 0;
                    while (ptr.nodes[0] !== null) {
                        ptr = ptr.nodes[0];
                    }
                } else if (ptr.leaves.length > index+1) { // Next
                    index++;
                } else { // Ascend
                    do {
                        if ((ptr.parent instanceof Tree)) {
                            return;
                        }
                        index = asearch(ptr.parent.nodes, ptr);
                        ptr = ptr.parent;
                    } while (index >= ptr.leaves.length);
                }
            }
        };

        /**
         * Alias of {@link Tree#walkAsc}.
         * @param {*|function(*, *):(boolean|undefined)} minKey If omitted or NULL, starts at the beginning
         * @param {(*|(function(*, *):(boolean|undefined)))=} maxKey If omitted or NULL, walks till the end
         * @param {function(*, *):(boolean|undefined)=} callback Callback receiving the key and the corresponding value as its
         *  parameters. May explicitly return true to stop the loop.
         * @expose
         */
        Tree.prototype.walk = Tree.prototype.walkAsc;

        /**
         * Walks through all keys [minKey, ..., maxKey] in descending order.
         * @param {*|function(*, *):(boolean|undefined)} minKey If omitted or null, walks till the beginning
         * @param {(*|function(*, *):(boolean|undefined))=} maxKey If omitted or null, starts at the end
         * @param {function(*, *):(boolean|undefined)=} callback Callback receiving the key and the corresponding value as its
         *  parameters. May explicitly return true to stop the loop.
         * @expose
         */
        Tree.prototype.walkDesc = function(minKey, maxKey, callback) {
            if (typeof minKey == 'function') {
                callback = minKey;
                minKey = maxKey = null;
            } else if (typeof maxKey == 'function') {
                callback = maxKey;
                maxKey = null;
            }
            minKey = typeof minKey != 'undefined' ? minKey : null;
            maxKey = typeof maxKey != 'undefined' ? maxKey : null;
            var ptr, index;
            if (maxKey === null) { // If there is no maximum limit
                ptr = this.root; // set ptr to the outer right node
                while (ptr.nodes[ptr.nodes.length-1] !== null) {
                    ptr = ptr.nodes[ptr.nodes.length-1];
                }
                index = ptr.leaves.length-1; // and start at its last leaf
            } else { // Else lookup
                var result = this.root.search(maxKey);
                if (result.leaf) { // If the maximum key itself exists
                    ptr = result.leaf.parent; // set ptr to the containing node
                    index = asearch(ptr.leaves, result.leaf); // and start at its index
                } else { // If the key does not exist
                    ptr = result.node; // set ptr to the insertion node
                    index = result.index-1; // and start at the insertion index-1 (key < maxKey)
                    while (index < 0) { // on underrun, begin at the separator in the parent
                        if (ptr.parent instanceof Tree) {
                            return; // empty range
                        }
                        index = asearch(ptr.parent.nodes, ptr)-1;
                        if (index < 0) {
                            return; // empty range
                        }
                        ptr = ptr.parent;
                    }
                }
            }
            // ptr/index now points at our first result
            while (true) {
                if (minKey !== null && compare(ptr.leaves[index].key, minKey) < 0) {
                    break; // if there are no more keys bigger than minKey
                }
                if (callback(ptr.leaves[index].key, ptr.leaves[index].value)) {
                    break; // if the user explicitly breaks the loop by returning true
                }
                if (ptr.nodes[index] !== null) { // Descend
                    ptr = ptr.nodes[index];
                    while (ptr.nodes[ptr.nodes.length-1] !== null) {
                        ptr = ptr.nodes[ptr.nodes.length-1];
                    }
                    index = ptr.leaves.length-1;
                } else if (index > 0) { // Next
                    index--;
                } else { // Ascend
                    do {
                        if ((ptr.parent instanceof Tree)) {
                            return;
                        }
                        index = asearch(ptr.parent.nodes, ptr)-1;
                        ptr = ptr.parent;
                    } while (index < 0);
                }
            }
        };

        /**
         * Counts the number of keys between minKey and maxKey (both inclusive).
         * @param {*=} minKey If omitted, counts from the start
         * @param {*=} maxKey If omitted, counts till the end
         * @returns {number}
         * @expose
         */
        Tree.prototype.count = function(minKey, maxKey) {
            var n = 0;
            this.walk(
                typeof minKey != 'undefined' ? minKey : null,
                typeof maxKey != 'undefined' ? maxKey : null,
                function(key, value) { n++; }
            );
            return n;
        };

        /**
         * Prints out all nodes in the tree.
         * @expose
         */
        Tree.prototype.print = function() {
            this.root.print(0);
        };

        /**
         * Returns a string representation of this instance.
         * @returns {string}
         */
        Tree.prototype.toString = function() {
            return "Tree("+order+") "+this.root.toString();
        };

        return Tree;
    };

    BTree = btree.create(2, btree.numcmp);
})({ exports: null }, console);

function Graph() {
  var neighbors = this.neighbors = {}; // Key = vertex, value = array of neighbors.

  this.addEdge = function (u, v) {
    if (neighbors[u] === undefined) {  // Add the edge u -> v.
      neighbors[u] = [];
    }
    neighbors[u].push(v);
    if (neighbors[v] === undefined) {  // Also add the edge v -> u so as
      neighbors[v] = [];               // to implement an undirected graph.
    }
    neighbors[v].push(u);
  };

  return this;
}

function graph_shortestPath(graph, source, target) {
  var queue = [ source ],
      visited = { source: true },
      predecessor = {},
      tail = 0;
  while (tail < queue.length) {
    var u = queue[tail++],  // Pop a vertex off the queue.
        neighbors = graph.neighbors[u];
    if (!neighbors)
      throw `${u} does not exist.`;
    for (var i = 0; i < neighbors.length; ++i) {
      var v = neighbors[i];
      if (visited[v]) {
        continue;
      }
      visited[v] = true;
      if (v === target) {   // Check if the path is complete.
        var path = [ v ];   // If so, backtrack through the path.
        while (u !== source) {
          path.push(u);
          u = predecessor[u];
        }
        path.push(u);
        path.reverse();
        return path;
      }
      predecessor[v] = u;
      queue.push(v);
    }
  }
  // no path found
  return;
}

/*!
 * accounting.js v0.4.2
 * Copyright 2014 Open Exchange Rates
 *
 * Freely distributable under the MIT license.
 * Portions of accounting.js are inspired or borrowed from underscore.js
 *
 * Full details and documentation:
 * http://openexchangerates.github.io/accounting.js/
 */
var accounting;
(function(root, undefined) {

    /* --- Setup --- */

    // Create the local library object, to be exported or referenced globally later
    var lib = {};

    // Current version
    lib.version = '0.4.2';


    /* --- Exposed settings --- */

    // The library's settings configuration object. Contains default parameters for
    // currency and number formatting
    lib.settings = {
        currency: {
            symbol: "", // default currency symbol is '$'
            format: "%s%v", // controls output: %s = symbol, %v = value (can be object, see docs)
            decimal: ".", // decimal point separator
            thousand: ",", // thousands separator
            precision: 2, // decimal places
            grouping: 3 // digit grouping (not implemented yet)
        },
        number: {
            precision: 0, // default precision on numbers is 0
            grouping: 3, // digit grouping (not implemented yet)
            thousand: ",",
            decimal: "."
        }
    };


    /* --- Internal Helper Methods --- */

    // Store reference to possibly-available ECMAScript 5 methods for later
    var nativeMap = Array.prototype.map,
        nativeIsArray = Array.isArray,
        toString = Object.prototype.toString;

    /**
     * Tests whether supplied parameter is a string
     * from underscore.js
     */
    function isString(obj) {
        return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
    }

    /**
     * Tests whether supplied parameter is an array
     * from underscore.js, delegates to ECMA5's native Array.isArray
     */
    function isArray(obj) {
        return nativeIsArray ? nativeIsArray(obj) : toString.call(obj) === '[object Array]';
    }

    /**
     * Tests whether supplied parameter is a true object
     */
    function isObject(obj) {
        return obj && toString.call(obj) === '[object Object]';
    }

    /**
     * Extends an object with a defaults object, similar to underscore's _.defaults
     *
     * Used for abstracting parameter handling from API methods
     */
    function defaults(object, defs) {
        var key;
        object = object || {};
        defs = defs || {};
        // Iterate over object non-prototype properties:
        for (key in defs) {
            if (defs.hasOwnProperty(key)) {
                // Replace values with defaults only if undefined (allow empty/zero values):
                if (object[key] == null) object[key] = defs[key];
            }
        }
        return object;
    }

    /**
     * Implementation of `Array.map()` for iteration loops
     *
     * Returns a new Array as a result of calling `iterator` on each array value.
     * Defers to native Array.map if available
     */
    function map(obj, iterator, context) {
        var results = [],
            i, j;

        if (!obj) return results;

        // Use native .map method if it exists:
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);

        // Fallback for native .map:
        for (i = 0, j = obj.length; i < j; i++) {
            results[i] = iterator.call(context, obj[i], i, obj);
        }
        return results;
    }

    /**
     * Check and normalise the value of precision (must be positive integer)
     */
    function checkPrecision(val, base) {
        val = Math.round(Math.abs(val));
        return isNaN(val) ? base : val;
    }


    /**
     * Parses a format string or object and returns format obj for use in rendering
     *
     * `format` is either a string with the default (positive) format, or object
     * containing `pos` (required), `neg` and `zero` values (or a function returning
     * either a string or object)
     *
     * Either string or format.pos must contain "%v" (value) to be valid
     */
    function checkCurrencyFormat(format) {
        var defaults = lib.settings.currency.format;

        // Allow function as format parameter (should return string or object):
        if (typeof format === "function") format = format();

        // Format can be a string, in which case `value` ("%v") must be present:
        if (isString(format) && format.match("%v")) {

            // Create and return positive, negative and zero formats:
            return {
                pos: format,
                neg: format.replace("-", "").replace("%v", "-%v"),
                zero: format
            };

            // If no format, or object is missing valid positive value, use defaults:
        } else if (!format || !format.pos || !format.pos.match("%v")) {

            // If defaults is a string, casts it to an object for faster checking next time:
            return (!isString(defaults)) ? defaults : lib.settings.currency.format = {
                pos: defaults,
                neg: defaults.replace("%v", "-%v"),
                zero: defaults
            };

        }
        // Otherwise, assume format was fine:
        return format;
    }


    /* --- API Methods --- */

    /**
     * Takes a string/array of strings, removes all formatting/cruft and returns the raw float value
     * Alias: `accounting.parse(string)`
     *
     * Decimal must be included in the regular expression to match floats (defaults to
     * accounting.settings.number.decimal), so if the number uses a non-standard decimal
     * separator, provide it as the second argument.
     *
     * Also matches bracketed negatives (eg. "$ (1.99)" => -1.99)
     *
     * Doesn't throw any errors (`NaN`s become 0) but this may change in future
     */
    var unformat = lib.unformat = lib.parse = function(value, decimal) {
        // Recursively unformat arrays:
        if (isArray(value)) {
            return map(value, function(val) {
                return unformat(val, decimal);
            });
        }

        // Fails silently (need decent errors):
        value = value || 0;

        // Return the value as-is if it's already a number:
        if (typeof value === "number") return value;

        // Default decimal point comes from settings, but could be set to eg. "," in opts:
        decimal = decimal || lib.settings.number.decimal;

        // Build regex to strip out everything except digits, decimal point and minus sign:
        var regex = new RegExp("[^0-9-" + decimal + "]", ["g"]),
            unformatted = parseFloat(
            ("" + value)
                .replace(/\((?=\d+)(.*)\)/, "-$1") // replace bracketed values with negatives
            .replace(regex, '') // strip out any cruft
            .replace(decimal, '.') // make sure decimal point is standard
            );

        // This will fail silently which may cause trouble, let's wait and see:
        return !isNaN(unformatted) ? unformatted : 0;
    };


    /**
     * Implementation of toFixed() that treats floats more like decimals
     *
     * Fixes binary rounding issues (eg. (0.615).toFixed(2) === "0.61") that present
     * problems for accounting- and finance-related software.
     */
    var toFixed = lib.toFixed = function(value, precision) {
        precision = checkPrecision(precision, lib.settings.number.precision);

        var exponentialForm = Number(lib.unformat(value) + 'e' + precision);
        var rounded = Math.round(exponentialForm);
        var finalResult = Number(rounded + 'e-' + precision).toFixed(precision);
        return finalResult;
    };


    /**
     * Format a number, with comma-separated thousands and custom precision/decimal places
     * Alias: `accounting.format()`
     *
     * Localise by overriding the precision and thousand / decimal separators
     * 2nd parameter `precision` can be an object matching `settings.number`
     */
    var formatNumber = lib.formatNumber = lib.format = function(number, precision, thousand, decimal) {
        // Resursively format arrays:
        if (isArray(number)) {
            return map(number, function(val) {
                return formatNumber(val, precision, thousand, decimal);
            });
        }

        // Clean up number:
        number = unformat(number);

        // Build options object from second param (if object) or all params, extending defaults:
        var opts = defaults(
        (isObject(precision) ? precision : {
            precision: precision,
            thousand: thousand,
            decimal: decimal
        }),
        lib.settings.number),

            // Clean up precision
            usePrecision = checkPrecision(opts.precision),

            // Do some calc:
            negative = number < 0 ? "-" : "",
            base = parseInt(toFixed(Math.abs(number || 0), usePrecision), 10) + "",
            mod = base.length > 3 ? base.length % 3 : 0;

        // Format the number:
        return negative + (mod ? base.substr(0, mod) + opts.thousand : "") + base.substr(mod).replace(/(\d{3})(?=\d)/g, "$1" + opts.thousand) + (usePrecision ? opts.decimal + toFixed(Math.abs(number), usePrecision).split('.')[1] : "");
    };


    /**
     * Format a number into currency
     *
     * Usage: accounting.formatMoney(number, symbol, precision, thousandsSep, decimalSep, format)
     * defaults: (0, "$", 2, ",", ".", "%s%v")
     *
     * Localise by overriding the symbol, precision, thousand / decimal separators and format
     * Second param can be an object matching `settings.currency` which is the easiest way.
     *
     * To do: tidy up the parameters
     */
    var formatMoney = lib.formatMoney = function(number, symbol, precision, thousand, decimal, format) {
        // Resursively format arrays:
        if (isArray(number)) {
            return map(number, function(val) {
                return formatMoney(val, symbol, precision, thousand, decimal, format);
            });
        }

        // Clean up number:
        number = unformat(number);

        // Build options object from second param (if object) or all params, extending defaults:
        var opts = defaults(
        (isObject(symbol) ? symbol : {
            symbol: symbol,
            precision: precision,
            thousand: thousand,
            decimal: decimal,
            format: format
        }),
        lib.settings.currency),

            // Check format (returns object with pos, neg and zero):
            formats = checkCurrencyFormat(opts.format),

            // Choose which format to use for this value:
            useFormat = number > 0 ? formats.pos : number < 0 ? formats.neg : formats.zero;

        // Return with currency symbol added:
        return useFormat.replace('%s', opts.symbol).replace('%v', formatNumber(Math.abs(number), checkPrecision(opts.precision), opts.thousand, opts.decimal));
    };


    /**
     * Format a list of numbers into an accounting column, padding with whitespace
     * to line up currency symbols, thousand separators and decimals places
     *
     * List should be an array of numbers
     * Second parameter can be an object containing keys that match the params
     *
     * Returns array of accouting-formatted number strings of same length
     *
     * NB: `white-space:pre` CSS rule is required on the list container to prevent
     * browsers from collapsing the whitespace in the output strings.
     */
    lib.formatColumn = function(list, symbol, precision, thousand, decimal, format) {
        if (!list || !isArray(list)) return [];

        // Build options object from second param (if object) or all params, extending defaults:
        var opts = defaults(
        (isObject(symbol) ? symbol : {
            symbol: symbol,
            precision: precision,
            thousand: thousand,
            decimal: decimal,
            format: format
        }),
        lib.settings.currency),

            // Check format (returns object with pos, neg and zero), only need pos for now:
            formats = checkCurrencyFormat(opts.format),

            // Whether to pad at start of string or after currency symbol:
            padAfterSymbol = formats.pos.indexOf("%s") < formats.pos.indexOf("%v") ? true : false,

            // Store value for the length of the longest string in the column:
            maxLength = 0,

            // Format the list according to options, store the length of the longest string:
            formatted = map(list, function(val, i) {
                if (isArray(val)) {
                    // Recursively format columns if list is a multi-dimensional array:
                    return lib.formatColumn(val, opts);
                } else {
                    // Clean up the value
                    val = unformat(val);

                    // Choose which format to use for this value (pos, neg or zero):
                    var useFormat = val > 0 ? formats.pos : val < 0 ? formats.neg : formats.zero,

                        // Format this value, push into formatted list and save the length:
                        fVal = useFormat.replace('%s', opts.symbol).replace('%v', formatNumber(Math.abs(val), checkPrecision(opts.precision), opts.thousand, opts.decimal));

                    if (fVal.length > maxLength) maxLength = fVal.length;
                    return fVal;
                }
            });

        // Pad each number in the list and send back the column of numbers:
        return map(formatted, function(val, i) {
            // Only if this is a string (not a nested array, which would have already been padded):
            if (isString(val) && val.length < maxLength) {
                // Depending on symbol position, pad after symbol or at index 0:
                return padAfterSymbol ? val.replace(opts.symbol, opts.symbol + (new Array(maxLength - val.length + 1).join(" "))) : (new Array(maxLength - val.length + 1).join(" ")) + val;
            }
            return val;
        });
    };


    accounting = lib;

    // Root will be `window` in browser or `global` on the server:
}(this));

function accounting_numDigits(x) {
  return (Math.log10((x ^ (x >> 31)) - (x >> 31)) | 0) + 1;
}
const nanoid = function (length = 8) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};
/*
 * query : {
 *   [from: time,] // min (for opening books)
 *   [to: time,] // max (for opening books)
 *   queries: [{
 *     [type: "query",] // standalone query that doesn't involve other queries
 *     from: time,
 *     to: time,
 *     modifiers: {},
 *     flags: {},
 *     accounts: [], // for filtering entries
 *     [sum_accounts: []], // sum only these accounts
 *     collect: [
 *       'sum', // sum to data
 *       'count', // count entries
 *       'entries', // return entries
 *       'accounts_sum', // returns { acc_trans: sum }
 *     ]
 *   }]
 * }
 */
async function query_exec(query) {
  if (!query.queries.length) return [];
  let data = [];
  let _range_min = query.from;
  let _range_max = query.to;
  const ignoredMods = Object.keys(cmd_report_modifiers);
  for (let q of query.queries) {
    q.modifiers = q.modifiers || {};
    q.accounts = q.accounts || {};
    q.flags = q.flags || {};

    let regexMod = {};
    for (mod in q.modifiers) {
      if (ignoredMods.indexOf(mod) >= 0) continue;
      if (q.modifiers[mod]) regexMod[mod] = new RegExp(q.modifiers[mod], 'i');
    }
    q.regexMod = regexMod;

    let d = { from: q.from, to: q.to };
    data.push(d);

    q.from = q.from || _range_min || 0;
    q.to = q.to || _range_max || 0;
    if (isNaN(_range_min)) _range_min = q.from;
    if (isNaN(_range_max)) _range_max = q.to;
    _range_min = Math.min(_range_min, q.from);
    _range_max = Math.max(_range_max, q.to);

    for (let c of q.collect) {
      switch (c) {
        case 'sum':
          d.sum = new Money();
          break;
        case 'count':
          d.count = 0;
          break;
        case 'entries':
          d.entries = [];
          break;
        case 'accounts_sum':
          d.accounts_sum = {};
          break;
        default:
          throw `Unknown collect method: ${c}`;
      }
    }
  }

  await data_iterate_books(data_books_required(_range_min * 1000, _range_max * 1000),
    async function (book) {
    let len = book.length;
    ENTRY: while (len--) {
      let e = book[len];
      if (e.time < query.from || e.time >= query.to) continue;
      if (e.virt && args.flags.real) continue;
      let i = -1;
      QUERY: for (let q of query.queries) {
        i++;
        // handle flags
        if (q.flags['skip-book-close'] && e.bookClose && e.bookClose.toString() == 'true') continue QUERY;
        // handle time
        if ((q.from && e.time < q.from) || (q.to && e.time >= q.to)) continue;
        // handle modifiers
        for (mod in q.regexMod) {
          if (!e[mod]) {
            if (q.regexMod[mod].source == '(?:)') continue; // empty on both
            else continue QUERY;
          }
          if (!(e[mod].toString()).match(q.regexMod[mod])) continue QUERY;
        }
        // handle accounts && transfer sums & sum & count
        let sumTrans = q.collect.indexOf('accounts_sum') >= 0;
        let isSum = q.collect.indexOf('sum') >= 0;
        let sum = isSum ? new Money() : undefined;
        let sum_parent = q.flags['sum-parent'];
        let accSum = {};
        let matchTimes = 0;
        let broken = false;
        FOR: for (let qt of q.accounts) {
          for (let t of e.transfers) {
            if (t[1].match(qt)) {
              if (!broken) matchTimes++;
              broken = true;
              if (isSum) {
                sum = sum.plus(t[2]);
              }
            }
          }
        }
        if (matchTimes != q.accounts.length) continue QUERY;
        if (isSum || sumTrans) {
          for (let t of e.transfers) {
            if (sumTrans) {
              if (sum_parent) {
                let levels = t[1].split(".");
                let previous = "";
                for (let l of levels) {
                  let k = previous + l;
                  if (!accSum[k]) accSum[k] = new Money();
                  accSum[k] = accSum[k].plus(t[2]);
                  previous = k + ".";
                }
              } else {
                accSum[t[1]] = (accSum[t[1]] || new Money()).plus(t[2]);
              }
            }
            if (isSum && q.accounts.length == 0) sum = sum.plus(t[2]);
          }
        }
        // ======= done filtering =======
        if (q.callback) await q.callback(e);
        // store entries
        if (q.collect.indexOf('entries') >= 0) {
          data[i].entries.push(e);
        }
        // store rest of results
        if (sumTrans) data[i].accounts_sum = accSum.tryConvertArgs(q, e.time);
        if (isSum) data[i].sum = data[i].sum.plus(sum).tryConvertArgs(q, e.time);
        data[i].count++;
      }
    }

  });

  for (let i = 0;i < data.length;i++) {
    let d = data[i];
    if (query.cumulative && i - query.cumulative >= 0) {
      let prev = data[i - query.cumulative];
      for (let key in prev) {
        if (!isNaN(prev[key]))
          data[i][key] = prev[key].plus(data[i][key]);
      }
    }
    if (!isNaN(d.sum)) data.minSum = Math.min(d.sum, data.minSum || 0);
    if (!isNaN(d.count)) data.minCount = Math.min(d.count, data.minCount || 0);
    if (!isNaN(d.sum)) data.maxSum = Math.max(d.sum, data.maxSum || 0);
    if (!isNaN(d.count)) data.maxCount = Math.max(d.count, data.maxCount || 0);
  }
  return data;

}

function query_args_to_filter(args, collect=[]) {
  report_extract_account(args);
  report_extract_tags(args);
  let x = {
    modifiers: args.modifiers,
    flags: args.flags,
    accounts: args.accounts,
    collect: collect
  };
  x.from = (Date.parse(report_replaceDateStr(args.modifiers.from || '@min') + 'T00:00:00') / 1000 | 0);
  x.to = (Date.parse(report_replaceDateStr(args.modifiers.to || '@max') + 'T00:00:00') / 1000 | 0);
  return x;
}

 
function tag_add(entry, tag) {
  entry.tags = new Set(entry.tags ? entry.tags.toString().split(",") : undefined);
  entry.tags.add(tag.toUpperCase());
  entry.tags = Array.from(entry.tags).sort().join(",");
}

function tag_remove(entry, tag) {
  entry.tags = new Set(entry.tags ? entry.tags.toString().split(",") : undefined);
  entry.tags.delete(tag.toUpperCase());
  if (entry.tags.size)
    entry.tags = Array.from(new Set(entry.tags)).sort().join(",");
  else
    delete entry.tags;
}
var data = null;

function data_init_data() {
  data = {
    accounts: {},
    books: {}, // { 2019: [ ... ], 2020: [ ... ], ...  }
    booksOpened: {},
    budgets: {},
    defaultCurrency: '$',
    accountCurrency: {},
    priceFiles: [],
    priceGraph: new Graph(),
    prices: {} // { ['min', 'hr']: bTree( [time, Big(price)] ) }
  };
  return data;
}

data_init_data();

async function data_open_books(books) {
  for (let y of books) {
    if (data.booksOpened[y] >= DATA_BOOK_OPENED) continue;
    await fs_read_book(y);
    data.booksOpened[y] = Math.max(DATA_BOOK_OPENED, data.booksOpened[y]); // fs_read_book could set it to dirty
  }
}

function data_books_required(d1, d2) {
  d1 = new Date(d1).getFullYear();
  if (!d2) return d1;
  d2 = new Date(d2).getFullYear();
  let yr = [];
  for (let i=d1; i<=d2; i++) {
    yr.push(i);
  }
  return yr;
}

async function data_remove_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  data.books[y] = data.books[y].filter(x => x.uuid != entry.uuid);
  data.booksOpened[y] = DATA_BOOK_DIRTY;
}

async function data_remove_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  let book = data.books[y];
  for (let i = 0;i < book.length;i++) {
    if (book[i].uuid == entry.uuid) {
      data.booksOpened[y] = DATA_BOOK_DIRTY;
      book.splice(i, 1);
      return;
    }
  }
}

/*
 * finds entry with same uuid, delete old one, and add new one to the right year
 * returns true if found and modified
 * returns false if nothing was found
 */
async function data_modify_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  /* let range = await fs_get_data_range();
   * await data_open_books(range);
   *
   * (being able to edit means the entry must've been opened already)
   */
  FOR: for (let year in data.books) {
    let book = data.books[year];
    for (let i = 0;i < book.length;i++) {
      if (book[i].uuid == entry.uuid) {
        data.booksOpened[y] = DATA_BOOK_DIRTY;
        data.booksOpened[year] = DATA_BOOK_DIRTY;
        if (year == y) { // same book just update entry
          book[i] = entry;
          return true;
        } else {
          // remove old
          book.splice(i, 1);
          // add new
          data.books[y].push(entry);
          return true;
        }
      }
    }
  }
  return false;
}

async function data_push_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  data.books[y] = data.books[y] || [];
  data.books[y].push(entry);
  for (let t of entry.transfers) {
    let acc = t[1];
    data.accounts[acc] = 1;
  }
  data.booksOpened[y] = DATA_BOOK_DIRTY;
}

async function data_push_entries(entries) {
  let min, max;
  min = max = new Date().getTime() / 1000;
  for (let e of entries) {
    min = Math.min(min, e.time);
    max = Math.max(max, e.time);
  }
  await data_open_books(data_books_required(min * 1000, max * 1000));
  for (let e of entries)
    await data_push_entry(e);
}

async function data_iterate_books(books, callback, afterOpenCallback) {
  await data_open_books(books);
  if (afterOpenCallback) await afterOpenCallback();
  for (let b of books) {
    let book = data.books[b];
    if (await callback(book) == DATA_CALLBACK_STOP) break;
  }
}

/*
 * =====================================
 * Constants
 * =====================================
 */
DATA_BOOK_OPENED = 1;
DATA_BOOK_DIRTY = 2;

DATA_CALLBACK_STOP = 999;

/*
 * ======================================
 * Runtime infos
 * ======================================
 */
var data_acc_imb = 'Imbalance';
function fs_read_budgets_from_string(str) {
  let lines = str.replace(/\r/g, "").split("\n");
  let budgets = {};
  
  let entry = null;
  const commitEntry = (entry) => {
    budgets[entry.description] = entry;
  };
  
  for (let line of lines) {
    entry = fs_read_budget_proc_line(entry, line, commitEntry, Object.keys(budgets).length);
  }
  if (entry) { commitEntry(entry) }
  
  return budgets;
}

function fs_read_budget_proc_line(entry, line, commitEntry, entriesLength) {
  if (line[0] == ';') return entry;
  if (line[0] == '~') { // start entry
    if (entry) { commitEntry(entry) } // commit previous

    entry = {
      description: 'Unnamed budget ' + entriesLength,
      budgets: {},
      trackers: [],
      from: '@min',
      to: '@max'
    };
    entry.description = line.substring(1).trim() || entry.description;
  } else if (line.indexOf('  ;') === 0) { // entry meta data
    let colonIndex = line.indexOf(':');
    if (colonIndex < 0) { colonIndex = line.length; line += ':""'; }
    let key = line.substring(3, colonIndex);
    entry[key] = JSON.parse(line.substring(colonIndex + 1));
    
    if (key == 'from' || key == 'to') {
      entry[key] = Math.floor(Date.parse(report_replaceDateStr(entry[key]) + 'T00:00:00') / 1000);
    }
  } else if (line.indexOf('  ') === 0) { // budgets
    let splits = line.substring(2).split('\t');
    if (splits.length == 2) {
      let q = splits[0].trim();
      let amnt = splits[1].trim();
      
      let m = amnt.match(/(goal|limit) (-?\d+(\.\d*)?)-(-?\d+(\.\d*)?)/i);
      if (m) { // tracker
        entry.trackers.push({q: q, type: m[1], low: m[2], high: m[4]});
      } else if (!isNaN(m = Number(amnt))) { // traditional budget
        entry.budgets[q] = entry.budgets[q] || 0;
        entry.budgets[q] = new Big(entry.budgets[q]).plus(m).toNumber();
      }
      
    }
  }
  return entry;
}
function isNumberAtIndex(str, i) {
  switch(str[i]) {
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      return true;
  }
  return false;
}
var fs = typeof require != "undefined" ? require('fs') : {};
var readline = typeof require != "undefined" ? require('readline') : {};

var fs_data_range = [];

function fs_get_book_directory() {
  let match = fs_book_name.match(/^(.*\/)([^/]+)$/);
  return match ? match[1] : '.';
}

async function fs_get_data_range() {
  if (fs_book_name == '-') {
    return fs_data_range = Object.keys(data.books).map(x => Number(x)).sort();
  }
  let result = [];
  fs.readdirSync(fs_get_book_directory()).forEach(x => {
    let m = x.match(/\.(\d{4})\.ledg$/);
    if (m && m[1]) result.push(parseInt(m[1]));
  });
  return fs_data_range = result.sort();
}

async function fs_write_books() {
  if (fs_book_name == '-') return;
  for (let y in data.booksOpened) {
    if (data.booksOpened[y] == DATA_BOOK_DIRTY) {
      let path = fs_book_name + '.' + y + '.ledg';
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(path);
        for (let i = 0;i < data.books[y].length;i++) {
          file.write(fs_serialize_entry(data.books[y][i]) + "\n");
        }
        file.end();
        file.on("finish", resolve);
        file.on("error", reject);
      });
    }
  }
}

async function fs_write_config() {
  if (fs_book_name == '-') return;
  let path = fs_book_name + '.config.ledg';
  // TODO: need to be async later
  fs.writeFileSync(path, JSON.stringify({
    data: {
      accounts: data.accounts,
      defaultCurrency: data.defaultCurrency,
      accountCurrency: accountCurrency,
      priceFiles: priceFiles
    },
    data_acc_imb: data_acc_imb
  }, null, 2));
  // TODO: write price table & account currency types
}

async function fs_attempt_load_config() {
  if (fs_book_name == '-') return;
  let path = fs_book_name + '.config.ledg';
  // TODO: need to be async later
  try {
    let opts = JSON.parse(fs.readFileSync(path));
    // assign ensures backwards compatibility
    Object.assign(data, opts.data);
    data_acc_imb = opts.data_acc_imb || data_acc_imb;

    // read price files
    let dir = fs_get_book_directory();
    for (let path of data.priceFiles) {
      try {
        await fs_read_price(dir + path);
      } catch (e) {
        console.error(e);
      }
    }
  } catch (e) {}
}

async function fs_attempt_load_budgets() {
  if (fs_book_name == '-') return;
  let path = fs_book_name + '.budgets.ledg';
  // TODO: need to be async later
  try {
    let content = fs.readFileSync(path).toString();
    data.budgets = fs_read_budgets_from_string(content);
  } catch (e) {}
}

async function fs_construct_config() {
  if (fs_book_name == '-') return;
  await data_open_books(await fs_get_data_range());
  await fs_write_config();
}

/* Example:
 *
2021-03-14 Test #UocjnJc1
  ;goose:3.14159
  1	Expense.Taxes.Federal	2000.02
  2	Assets.Checking	-500
  3	Liability.CC	-1449.51
  	Imbalance	-50.51
*/
function fs_serialize_entry(entry) {
  let str = entry_datestr(entry) + ' ' + entry.description.trim() + ' #' + entry.uuid;
  for (let key in entry) {
    if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
    str += '\n  ;' + key + ':' + JSON.stringify(entry[key]);
  }
  str += '\n';
  for (let t of entry.transfers) {
    str += '  ' + t[0] + '\t' + t[1] + '\t' + t[2].serialize() + '\n';
  }
  return str;
}

function fs_serialize_entry_ledger(entry) {
  let str = entry_datestr(entry) + ' ' + entry.description.trim() + ' #' + entry.uuid;
  FOR: for (let key in entry) {
    switch (key) {
      case 'description':
      case 'time':
      case 'uuid':
      case 'transfers':
      case 'virt':
        continue FOR;
    }
    str += '\n  ;' + key + ':' + JSON.stringify(entry[key]);
  }
  str += '\n';
  for (let t of entry.transfers) {
    if (t[0]) str += '  ;' + t[0] + '\n';
    let acc = t[1].replace(/:/g, ESC).replace(/\./g, ':').replace(new RegExp(ESC, "i"), '.');
    if (entry.virt)
      acc = '[' + acc + ']';
    Object.keys(t[2].amnts).forEach(cur => {
      let amnt = new Money(t[2].amnts[cur], cur);
      str += '  ' +
             acc +
             '     ' + amnt.serialize() + '\n';
    });
  }
  return str;
}

/*
 * ========================
 * FS runtime variables
 * ========================
 */
var fs_book_name = 'book'; // ex: book.2019.ledg, book.ledg, book.budget.ledg
var _fs_entries_read = 0;
async function fs_read_book(year) {
  let _start;
  if (DEBUG) { _start = new Date(); }
  let path = fs_book_name + '.' + year + '.ledg';
  data.books[year] = [];
  if (fs_book_name != '-' && fs.existsSync(path)) {
    let fileStream = fs.createReadStream(path);

    let rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let entry = null;
    const commitEntry = (entry) => {
      entry_balance(entry);
      // console.log("commit====");
      // console.log(entry.transfers.map(x => [x[0], x[1], x[2].toString()]));
      data.books[year].push(entry);
      _fs_entries_read++;
    };

    for await (let line of rl) {
      entry = fs_read_book_proc_line(entry, line, commitEntry);
    }
    if (entry) { commitEntry(entry) }
  }
  if (DEBUG) console.debug(`Opened ${year} book in ${new Date() - _start}ms, ${_fs_entries_read} entries read so far`);
}

function fs_read_entries_from_string(str) {
  let lines = str.replace(/\r/g, "").split("\n");
  let entries = [];

  let entry = null;
  const commitEntry = (entry) => {
    entry_balance(entry);
    entries.push(entry);
  };

  for (let line of lines) {
    entry = fs_read_book_proc_line(entry, line, commitEntry);
  }
  if (entry) { commitEntry(entry) }

  return entries;
}

function fs_read_book_proc_line(entry, line, commitEntry) {
  if (line[0] == ';') return entry;
  if (line[4] == '-' && line[7] == '-') { // start entry
    if (entry) { commitEntry(entry) } // commit previous

    entry = {
      time: Math.floor(Date.parse(line.substring(0, 10) + 'T00:00:00') / 1000),
      transfers: []
    };

    let hash_index = line.indexOf('#');

    let UUIDreassigned = false;

    if (line.trim().length <= 11 || hash_index < 0) { // has no hash or has no description
      entry.description = line.substring(11);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
    } else if (line.length - hash_index < 9) { // has hash but incomplete uuid
      entry.description = line.substring(11, hash_index - 1);
      entry.uuid = nanoid(8);
      UUIDreassigned = true;
    } else {
      entry.description = line.substring(11, line.length - 10).trim();
      entry.uuid = line.substr(line.length - 8, 8);
    }

    if (UUIDreassigned) {
      let year = new Date(entry.time * 1000).getFullYear();
      data.booksOpened[year] = DATA_BOOK_DIRTY;
      console.log(`While opening the ${year} book, an entry had incomplete UUID and had been reassigned.`);
    }
  } else if (line[2] == ';') { // entry meta data
    let colonIndex = line.indexOf(':');
    if (colonIndex < 0) { colonIndex = line.length; line += ':""'; }
    entry[line.substring(3, colonIndex)] = JSON.parse(line.substring(colonIndex + 1));
  } else if (line[0] == ' ' && line[1] == ' ') { // transfers
    let t = [];
    let splits = line.substring(2).split('\t');
    if (splits.length >= 2) {
      t[0] = splits[0];
      t[1] = splits[1].trim();
      data.accounts[t[1]] = 1;
      if (splits[2]) splits[2] = splits[2].trim();
      t[2] = Money.parseMoney(splits[2] && splits[2].length ? splits[2] : '0', entry.time);
      if (t[2] === false) throw `Cannot parse ${splits[2]} as a value.`;
      entry.transfers.push(t);
    }
  }
  return entry;
}
var _fs_prices_read = 0;
async function fs_read_price(path) {
  let _start;
  if (DEBUG) { _start = new Date(); }
  if (fs.existsSync(path)) {
    let fileStream = fs.createReadStream(path);

    let rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let price = null;
    const commitPrice = (price) => {
      let key = price.c1 + ',' + price.c2;
      let tree = data.prices[key] = data.prices[key] || new BTree();
      tree.put(price.time, new Big(price.price));
      // reverse
      key = price.c2 + ',' + price.c1;
      tree = data.prices[key] = data.prices[key] || new BTree();
      tree.put(price.time, price.price ? new Big(1).div(price.price) : 0);

      data.priceGraph.addEdge(price.c1, price.c2);
    };

    for await (let line of rl) {
      price = fs_read_price_proc_line(price, line, commitPrice);
    }
    if (price) { commitPrice(price) }
  } else {
    throw `Price file ${path} is not found.`;
  }
  if (DEBUG) console.debug(`Opened ${path} price table in ${new Date() - _start}ms, ${_fs_prices_read} prices read so far`);
}

function fs_read_price_proc_line(price, line, commitPrice) {
  line = line.trim();
  if (line[0] == ';') return price;
  if (line[0] == 'P') { // start price
    if (price) commitPrice(price);

    let match = line.match(/^P\s+(\d{4}-\d{2}-\d{2})\s+([^\d\s,\-.]+)\s+((-?[\d.]+)\s*([^\d\s,\-.]+)|([^\d\s,\-.]+)\s*(-?[\d.]+))\s*$/);

    if (!match)
      throw `"${line}" is not a valid price declaration`;

    let date = match[1];
    let cur1 = match[2];
    let cur2 = match[5] || match[6];
    let p = Number(match[4] || match[7]);

    price = {
      time: Date.parse(date + 'T00:00:00') / 1000 | 0,
      c1: cur1,
      c2: cur2,
      price: p
    };
  }
  return price;
}
/*
MIT License

Copyright © 2016 Igor Kroitor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
 
var asciichart = {};

(function (exports) {

    // control sequences for coloring

    exports.black = "\x1b[30m"
    exports.red = "\x1b[31m"
    exports.green = "\x1b[32m"
    exports.yellow = "\x1b[33m"
    exports.blue = "\x1b[34m"
    exports.magenta = "\x1b[35m"
    exports.cyan = "\x1b[36m"
    exports.lightgray = "\x1b[37m"
    exports.default = "\x1b[39m"
    exports.darkgray = "\x1b[90m"
    exports.lightred = "\x1b[91m"
    exports.lightgreen = "\x1b[92m"
    exports.lightyellow = "\x1b[93m"
    exports.lightblue = "\x1b[94m"
    exports.lightmagenta = "\x1b[95m"
    exports.lightcyan = "\x1b[96m"
    exports.white = "\x1b[97m"
    exports.reset = "\x1b[0m"

    function colored (char, color) {
        // do not color it if color is not specified
        return (color === undefined) ? char : (color + char + exports.reset)
    }

    exports.colored = colored

    exports.plot = function (series, cfg = undefined) {
        // this function takes both one array and array of arrays
        // if an array of numbers is passed it is transformed to
        // an array of exactly one array with numbers
        if (typeof(series[0]) == "number"){
            series = [series]
        }

        cfg = (typeof cfg !== 'undefined') ? cfg : {}

        let min = (typeof cfg.min !== 'undefined') ? cfg.min : series[0][0]
        let max = (typeof cfg.max !== 'undefined') ? cfg.max : series[0][0]

        for (let j = 0; j < series.length; j++) {
            for (let i = 0; i < series[j].length; i++) {
                min = Math.min(min, series[j][i])
                max = Math.max(max, series[j][i])
            }
        }

        let defaultSymbols = [ '┼', '┤', '╶', '╴', '─', '╰', '╭', '╮', '╯', '│' ]
        let range   = Math.abs (max - min)
        let offset  = (typeof cfg.offset  !== 'undefined') ? cfg.offset  : 3
        let padding = (typeof cfg.padding !== 'undefined') ? cfg.padding : '           '
        let height  = (typeof cfg.height  !== 'undefined') ? cfg.height  : range
        let colors  = (typeof cfg.colors !== 'undefined') ? cfg.colors : []
        let ratio   = range !== 0 ? height / range : 1;
        let min2    = Math.round (min * ratio)
        let max2    = Math.round (max * ratio)
        let rows    = Math.abs (max2 - min2)
        let width = 0
        for (let i = 0; i < series.length; i++) {
            width = Math.max(width, series[i].length)
        }
        width = width + offset
        let symbols = (typeof cfg.symbols !== 'undefined') ? cfg.symbols : defaultSymbols
        let format  = (typeof cfg.format !== 'undefined') ? cfg.format : function (x) {
            return (padding + x.toFixed (2)).slice (-padding.length)
        }

        let result = new Array (rows + 1) // empty space
        for (let i = 0; i <= rows; i++) {
            result[i] = new Array (width)
            for (let j = 0; j < width; j++) {
                result[i][j] = ' '
            }
        }
        for (let y = min2; y <= max2; ++y) { // axis + labels
            let label = format (rows > 0 ? max - (y - min2) * range / rows : y, y - min2)
            result[y - min2][Math.max (offset - label.length, 0)] = label
            result[y - min2][offset - 1] = (y == 0) ? symbols[0] : symbols[1]
        }

        for (let j = 0; j < series.length; j++) {
            let currentColor = colors[j % colors.length]
            let y0 = Math.round (series[j][0] * ratio) - min2
            result[rows - y0][offset - 1] = colored(symbols[0], currentColor) // first value

            for (let x = 0; x < series[j].length - 1; x++) { // plot the line
                let y0 = Math.round (series[j][x + 0] * ratio) - min2
                let y1 = Math.round (series[j][x + 1] * ratio) - min2
                if (y0 == y1) {
                    result[rows - y0][x + offset] = colored(symbols[4], currentColor)
                } else {
                    result[rows - y1][x + offset] = colored((y0 > y1) ? symbols[5] : symbols[6], currentColor)
                    result[rows - y0][x + offset] = colored((y0 > y1) ? symbols[7] : symbols[8], currentColor)
                    let from = Math.min (y0, y1)
                    let to = Math.max (y0, y1)
                    for (let y = from + 1; y < to; y++) {
                        result[rows - y][x + offset] = colored(symbols[9], currentColor)
                    }
                }
            }
        }
        return result.map (function (x) { return x.join ('') }).join ('\n')
    }

}) (asciichart);
/*
The MIT License (MIT)

Copyright (c) 2015-present, Brian Woodward.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// from github ansi-colors
// with slight modifications
const isObject = val => val !== null && typeof val === 'object' && !Array.isArray(val);
const identity = val => val;

/* eslint-disable no-control-regex */
// this is a modified version of https://github.com/chalk/ansi-regex (MIT License)
const ANSI_REGEX = /[\u001b\u009b][[\]#;?()]*(?:(?:(?:[^\W_]*;?[^\W_]*)\u0007)|(?:(?:[0-9]{1,4}(;[0-9]{0,4})*)?[~0-9=<>cf-nqrtyA-PRZ]))/g;

const create_color = () => {
  const colors = { enabled: true, visible: true, styles: {}, keys: {} };

  // if ('FORCE_COLOR' in process.env) {
  //   colors.enabled = process.env.FORCE_COLOR !== '0';
  // }

  const ansi = style => {
    let open = style.open = `\u001b[${style.codes[0]}m`;
    let close = style.close = `\u001b[${style.codes[1]}m`;
    let regex = style.regex = new RegExp(`\\u001b\\[${style.codes[1]}m`, 'g');
    style.wrap = (input, newline) => {
      if (input.includes(close)) input = input.replace(regex, close + open);
      let output = open + input + close;
      // see https://github.com/chalk/chalk/pull/92, thanks to the
      // chalk contributors for this fix. However, we've confirmed that
      // this issue is also present in Windows terminals
      return newline ? output.replace(/\r*\n/g, `${close}$&${open}`) : output;
    };
    return style;
  };

  const wrap = (style, input, newline) => {
    return typeof style === 'function' ? style(input) : style.wrap(input, newline);
  };

  const style = (input, stack) => {
    if (input === '' || input == null) return '';
    if (colors.enabled === false) return input;
    if (colors.visible === false) return '';
    let str = '' + input;
    let nl = str.includes('\n');
    let n = stack.length;
    if (n > 0 && stack.includes('unstyle')) {
      stack = [...new Set(['unstyle', ...stack])].reverse();
    }
    while (n-- > 0) str = wrap(colors.styles[stack[n]], str, nl);
    return str;
  };

  const define = (name, codes, type) => {
    colors.styles[name] = ansi({ name, codes });
    let keys = colors.keys[type] || (colors.keys[type] = []);
    keys.push(name);

    Reflect.defineProperty(colors, name, {
      configurable: true,
      enumerable: true,
      set(value) {
        colors.alias(name, value);
      },
      get() {
        let color = input => style(input, color.stack);
        Reflect.setPrototypeOf(color, colors);
        color.stack = this.stack ? this.stack.concat(name) : [name];
        return color;
      }
    });
  };

  define('reset', [0, 0], 'modifier');
  define('bold', [1, 22], 'modifier');
  define('dim', [2, 22], 'modifier');
  define('italic', [3, 23], 'modifier');
  define('underline', [4, 24], 'modifier');
  define('inverse', [7, 27], 'modifier');
  define('hidden', [8, 28], 'modifier');
  define('strikethrough', [9, 29], 'modifier');

  define('black', [30, 39], 'color');
  define('red', [31, 39], 'color');
  define('green', [32, 39], 'color');
  define('yellow', [33, 39], 'color');
  define('blue', [34, 39], 'color');
  define('magenta', [35, 39], 'color');
  define('cyan', [36, 39], 'color');
  define('white', [37, 39], 'color');
  define('gray', [90, 39], 'color');
  define('grey', [90, 39], 'color');

  define('bgBlack', [40, 49], 'bg');
  define('bgRed', [41, 49], 'bg');
  define('bgGreen', [42, 49], 'bg');
  define('bgYellow', [43, 49], 'bg');
  define('bgBlue', [44, 49], 'bg');
  define('bgMagenta', [45, 49], 'bg');
  define('bgCyan', [46, 49], 'bg');
  define('bgWhite', [47, 49], 'bg');

  define('blackBright', [90, 39], 'bright');
  define('redBright', [91, 39], 'bright');
  define('greenBright', [92, 39], 'bright');
  define('yellowBright', [93, 39], 'bright');
  define('blueBright', [94, 39], 'bright');
  define('magentaBright', [95, 39], 'bright');
  define('cyanBright', [96, 39], 'bright');
  define('whiteBright', [97, 39], 'bright');

  define('bgBlackBright', [100, 49], 'bgBright');
  define('bgRedBright', [101, 49], 'bgBright');
  define('bgGreenBright', [102, 49], 'bgBright');
  define('bgYellowBright', [103, 49], 'bgBright');
  define('bgBlueBright', [104, 49], 'bgBright');
  define('bgMagentaBright', [105, 49], 'bgBright');
  define('bgCyanBright', [106, 49], 'bgBright');
  define('bgWhiteBright', [107, 49], 'bgBright');

  colors.ansiRegex = ANSI_REGEX;
  colors.hasColor = colors.hasAnsi = str => {
    colors.ansiRegex.lastIndex = 0;
    return typeof str === 'string' && str !== '' && colors.ansiRegex.test(str);
  };

  colors.alias = (name, color) => {
    let fn = typeof color === 'string' ? colors[color] : color;

    if (typeof fn !== 'function') {
      throw new TypeError('Expected alias to be the name of an existing color (string) or a function');
    }

    if (!fn.stack) {
      Reflect.defineProperty(fn, 'name', { value: name });
      colors.styles[name] = fn;
      fn.stack = [name];
    }

    Reflect.defineProperty(colors, name, {
      configurable: true,
      enumerable: true,
      set(value) {
        colors.alias(name, value);
      },
      get() {
        let color = input => style(input, color.stack);
        Reflect.setPrototypeOf(color, colors);
        color.stack = this.stack ? this.stack.concat(fn.stack) : fn.stack;
        return color;
      }
    });
  };

  colors.theme = custom => {
    if (!isObject(custom)) throw new TypeError('Expected theme to be an object');
    for (let name of Object.keys(custom)) {
      colors.alias(name, custom[name]);
    }
    return colors;
  };

  colors.alias('unstyle', str => {
    if (typeof str === 'string' && str !== '') {
      colors.ansiRegex.lastIndex = 0;
      return str.replace(colors.ansiRegex, '');
    }
    return '';
  });

  colors.alias('noop', str => str);
  colors.none = colors.clear = colors.noop;

  colors.stripColor = colors.unstyle;
  // colors.symbols = require('./symbols');
  colors.define = define;
  return colors;
};

const c = create_color();
const ansi_regex = (({onlyFirst = false} = {}) => {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
})();
const strip_ansi = string => typeof string === 'string' ? string.replace(ansi_regex, '') : string;

async function cmd_burndown(args) {
  console.clear();
  if (process.stdout.columns <= 10 || process.stdout.rows <= 15) {
    console.error('Terminal too small.');
    return 1;
  }
  if (args.flags['skip-book-close'] !== false)
    args.flags['skip-book-close'] = true;

  if (args.flags.abs !== false)
    args.flags.abs = true;

  let int = report_get_reporting_interval(args);
  let showDays = true;
  let showMonth = true;
  let showWeeks = int[2] >= 7 && int[2] % 7 == 0;
  let showQuarter = int[1] >= 3 && int[1] % 3 == 0;

  if (int[2] > 0 && int[2] < 7) {
    cmd_report_modifiers.from = '@month-start';
    cmd_report_modifiers.to = '@tomorrow';
  } else if (showWeeks) {
    cmd_report_modifiers.from = '@year-start';
    cmd_report_modifiers.to = '@month-end';
  } else {
    cmd_report_modifiers.from = '@last-year';
    cmd_report_modifiers.to = '@month-end';
  }
  report_set_modifiers(args);
  args.modifiers.from = cmd_report_modifiers.from;
  args.modifiers.to = cmd_report_modifiers.to;

  let strF = report_replaceDateStr(args.modifiers.from);
  let strT = report_replaceDateStr(args.modifiers.to);
  let from = Date.parse(strF + 'T00:00:00');
  let to = Date.parse(strT + 'T00:00:00');

  let legends = [];

  let argQueries = Object.keys(args.flags).sort().filter(x => x.match(/q\d+/)).map(x => {
    let v = args.flags[x];
    if (typeof v !== 'string' || !v.length) {
      console.error(`Warning: skipped ${x}, invalid query`);
      return null;
    }
    legends.push(v);
    let args2 = argsparser(parseArgSegmentsFromStr(v));
    return args2;
  }).filter(x => !!x);
  if (!argQueries.length) {
    argQueries = [argsparser(parseArgSegmentsFromStr(cmd_report_accounts.income)),
                  argsparser(parseArgSegmentsFromStr(cmd_report_accounts.expense))];
    legends = [cmd_report_accounts.income, cmd_report_accounts.expense];
  }
  let maxIntervals = (process.stdout.columns - 8) / (argQueries.length * 2 + 1) | 0;
  let query = { cumulative: args.flags.cumulative && argQueries.length, from: from / 1000 | 0, to: to / 1000 | 0, queries: [] };
  let collect = args.flags.count ? ['count'] : ['sum'];

  let crntD = new Date(from);
  let intervals = 0;
  while (crntD < to) {
    let a = crntD.getTime() / 1000 | 0;
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    let b = Math.min(crntD.getTime(), to) / 1000 | 0;

    for (let i = 0;i < argQueries.length;i++) {
      let q = query_args_to_filter(argQueries[i]);
      q.from = a;
      q.flags['skip-book-close'] = true;
      q.to = b;
      q.collect = collect;
      query.queries.push(q);
    }

    intervals++;
  }
  if (intervals > maxIntervals) {
    console.error(`Terminal is too small for ${intervals} intervals, max ${maxIntervals}.`);
    return 1;
  }
  let data = await query_exec(query);
  let max = Math.max(data.maxSum || data.maxCount, 0);
  let min = Math.min(data.minSum || data.minCount, 0);
  if (args.flags.abs && !isNaN(data.maxSum)) {
    max = Math.max(Math.max(Math.abs(data.minSum), data.maxSum), 0);
    min = 0;
  }
  let _d = [];
  for (let i = 0;i < data.length;i += argQueries.length) {
    let row = [];
    for (let j = 0;j < argQueries.length;j++) {
      row[j] = data[i + j][args.flags.count ? 'count' : 'sum'];
      if (args.flags.abs) row[j] = Math.abs(row[j]);
    }
    _d.push(row);
  }

  let chart = new Chart(min, max, _d);

  let daysToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);
  let weeksToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);
  let monthsToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);
  let yearsToDraw = Array(_d.length * (argQueries.length * 2 + 1)).fill(0);

  let drawWeeks = showWeeks;
  let drawDays = int[2] > 0;
  let drawMonths = false;
  let drawYears = false;

  crntD = new Date(from);
  let i = -1;
  let lastM = -1;
  let lastY = -1;
  while (crntD < to) {
    i++;
    let row = [crntD.getFullYear().toString()];
    if (showQuarter) row.push(print_full_quarter(crntD.getMonth()));

    let d = crntD.getDate();
    daysToDraw[i] = d.toString().padStart(2, '0');
    weeksToDraw[i] = pring_week(crntD).toString().padStart(2, '0');

    if ((d == 1) || (lastM != -1 && lastM != crntD.getMonth())) {
      drawMonths = true;
      monthsToDraw[i] = (int[1] > 0 || int[2] >= 14) ?
        (crntD.getMonth() + 1).toString().padStart(2, '0') : print_full_month(crntD.getMonth());
      lastM = crntD.getMonth();
    }
    if ((crntD.getMonth() == 0 && d == 1) || (lastY != -1 && lastY != crntD.getFullYear())) {
      drawYears = true;
      yearsToDraw[i] = int[0] ? (crntD.getYear() - 100).toString() : crntD.getFullYear().toString();
      lastY = crntD.getFullYear();
    }
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
  }

  let r = -1;
  if (drawDays) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    chart.replace(chart.gh + 2 + r, 0, ' Day');
    daysToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }
  if (drawWeeks) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    chart.replace(chart.gh + 2 + r, 0, ' Week');
    weeksToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }
  if (drawMonths) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    chart.replace(chart.gh + 2 + r, 0, 'Month');
    monthsToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }
  if (drawYears) {
    chart.buffer.push(Array(chart.gw).fill(" "));
    r++;
    yearsToDraw.forEach((x, i) => {
      chart.replace(chart.gh + 2 + r, 7 + (i * (argQueries.length * 2 + 1)), x);
    });
  }

  console.log(chart.render() + '\n');
  let table = [[]];
  legends.forEach((x, i) => {
    let str = `      ${chart.colors[i]('  ')} ${x}`;
    table[0].push([str, strip_ansi(str).length]);
  });
  table[0].header = false;
  console.log(tabulate(table));
}
async function cmd_export_gnucash_transactions(args) {
  let table = [['Date', 'Num', 'Description', 'Memo', 'Account', 'Deposit', 'Withdrawal']];
  
  let q = { queries: [query_args_to_filter(args)] };
  q.queries[0].collect = ['entries'];

  let data = (await query_exec(q))[0].entries;
  for (let e of data) {
    for (let t of e.transfers) {
      table.push([
        entry_datestr(e),
        e.uuid,
        e.description,
        t[0],
        t[1].replace(/\./g, ':'),
        t[2] >= 0 ? t[2] : '',
        t[2] < 0 ? -t[2] : ''
      ]);
    }
  }
  
  return table;
}
async function cmd_export_gnucash_accounts(args) {
  report_set_accounts(args);
  report_compile_account_regex(args);
  
  let table = [['type','full_name','name','code','description','color','notes','commoditym','commodityn','hidden','tax','placeholder']];
  // ASSET,Assets,Assets,,,,,USD,CURRENCY,F,F,F
  let q = { queries: [query_args_to_filter(args)] };
  await query_exec(q);
  
  let accounts = expand_account();
  for (let a of accounts) {
    let type;
    if (a.match(cmd_report_accounts_compiled.income)) type = "INCOME";
    else if (a.match(cmd_report_accounts_compiled.expense)) type = "EXPENSE";
    else if (a.match(cmd_report_accounts_compiled.asset)) type = "ASSET";
    else if (a.match(cmd_report_accounts_compiled.liability)) type = "LIABILITY";
    else type = "EQUITY";
    table.push([
      type,
      a.replace(/\./g, ':'),
      a.replace(/^(.+\.)*([^.]+)$/, '$2'),
      '',
      '',
      '',
      '',
      'USD',
      'CURRENCY',
      'F',
      'F',
      'F',
    ]);
  }
  
  return table;
}

async function cmd_history(args) {
  if (args.flags['skip-book-close'] !== false)
    args.flags['skip-book-close'] = true;

  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = undefined;

  let int = report_get_reporting_interval(args);
  let showDays = true;
  let showMonth = true;
  let showWeeks = int[2] >= 7 && int[2] % 7 == 0;
  let showQuarter = int[1] >= 3 && int[1] % 3 == 0;

  if (int[2] > 0 && int[2] < 7) {
    cmd_report_modifiers.from = '@month-start';
    cmd_report_modifiers.to = '@tomorrow';
  } else if (showWeeks) {
    cmd_report_modifiers.from = '@year-start';
    cmd_report_modifiers.to = '@month-end';
  } else {
    cmd_report_modifiers.from = '@last-year';
    cmd_report_modifiers.to = '@month-end';
  }
  report_set_modifiers(args);
  report_set_accounts(args);
  report_compile_account_regex();

  args.modifiers.from = cmd_report_modifiers.from;
  args.modifiers.to = cmd_report_modifiers.to;

  let skipTo;
  args.flags['skip'] &&
     (skipTo = report_replaceDateStr(args.flags['skip'])) &&
     !isNaN(skipTo = Date.parse(skipTo + 'T00:00:00'));

  let strF = report_replaceDateStr(args.modifiers.from);
  let strT = report_replaceDateStr(args.modifiers.to);
  let from = Date.parse(strF + 'T00:00:00');
  let to = Date.parse(strT + 'T00:00:00');

  let dateFunctions = [];

  let crntD = new Date(from);
  while (crntD < to) {
    let a = crntD.getTime() / 1000 | 0;
    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    let b = Math.min(crntD.getTime(), to) / 1000 | 0;
    dateFunctions.push(t => t >= a && t < b);
  }

  report_extract_account(args);
  report_extract_tags(args);

  let accounts = args.accounts.length ?
                   [...args.accounts.map((x, i) => { return { q: x, name: args.accountSrc[i], sum: new Big(0), val: Array(dateFunctions.length).fill(new Big(0)) } })] :
                   [...Object.keys(cmd_report_accounts).map(x => { return { name: x, q: cmd_report_accounts_compiled[x], sum: new Money(), val: Array(dateFunctions.length).fill(new Money()) } })];

  delete args.accounts; // so report_traverse don't handle accounts

  await report_traverse(args, async function (entry) {
    let i = 0;
    let matched = false;
    for (;i < dateFunctions.length;i++) {
      if (dateFunctions[i](entry.time)) {
        matched = true;
        break;
      }
    }
    if (!matched) return; // outside date range
    for (let acc of accounts) {
      let q = acc.q;

      for (let t of entry.transfers) {
        if (t[1].match(q)) {
          acc.val[i] = acc.val[i].plus(t[2].tryConvertArgs(args, entry.time));
          acc.sum = acc.sum.plus(t[2].tryConvertArgs(args, entry.time));
        }
      }
    }
  });

  let table = [];
  let align = [];
  if (!args.flags.epoch && !args.flags.iso) {
    table.push(['Year']);
    align.push(TAB_ALIGN_RIGHT);
    if (showQuarter) { table[0].push('Quarter'); align.push(TAB_ALIGN_LEFT) }
    if (showMonth) { table[0].push('Month'); align.push(TAB_ALIGN_LEFT) }
    if (showWeeks) { table[0].push('Week'); align.push(TAB_ALIGN_RIGHT) }
    if (showDays) { table[0].push('Day');  align.push(TAB_ALIGN_RIGHT)}
  } else {
    table.push(['Time']);
    align.push(TAB_ALIGN_RIGHT);
  }
  let tab_left_length = table[0].length;


  let cu_accounts = [];

  if (typeof args.flags['cumulative-columns'] != 'undefined') {
    let sp = args.flags['cumulative-columns'].toString().split(',').map(x => parseInt(x));
    for (let n of sp) {
      if (isNaN(n)) {
        console.log(`Error: "${n}" is not a column number. Use this format: --cumulative-columns=1,2,3`);
        return 1;
      }
      cu_accounts.push(n - 1);
    }
  }
  accounts.forEach((x, i) => {
    table[0].push(x.name[0].toUpperCase() + x.name.substring(1));
    align.push(TAB_ALIGN_RIGHT);
    if (args.flags.cumulative || cu_accounts.indexOf(i) >= 0) {
      x.val.forEach((z, j) => {
        if (j == 0) return;
        x.val[j] = x.val[j].plus(x.val[j - 1]);
      });
    }
  });

  crntD = new Date(from);
  let r = table.length - 2;
  let last = [];
  while (crntD < to) {
    r++;
    if (skipTo && crntD < skipTo) {
      crntD.setFullYear(crntD.getFullYear() + int[0]);
      crntD.setMonth(crntD.getMonth() + int[1]);
      crntD.setDate(crntD.getDate() + int[2]);
      continue;
    }
    let row = [];

    if (args.flags.epoch) {
      row.push(crntD.getTime().toString());
    } else if (args.flags.iso) {
      row.push(crntD.toISOString().split('T')[0]);
    } else {
      row.push(crntD.getFullYear().toString());
      if (showQuarter) row.push(print_full_quarter(crntD.getMonth()));
      if (showMonth) row.push(print_full_month(crntD.getMonth()));
      if (showWeeks) row.push(pring_week(crntD));
      if (showDays) row.push(crntD.getDate());

      if (r == dateFunctions.length - 1) { // last entry
        row[row.length - 1] = '≥ ' + row[row.length - 1];
      }

      let current = Array.from(row);
      let lastChanged = !!args.flags.csv;
      for (let i = 0;i < row.length;i++) {
        if (table[0][i] == 'Day') continue;
        if (!lastChanged && (current[i] == last[i])) row[i] = '';
        else if (current[i] != last[i]) lastChanged = true;
      }
      last = current;
    }
    for (let acc of accounts) {
      let v = acc.val[r];

      if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense ||
          args.flags.invert) {
        v = v.timesPrim(-1);
      }
      row.push(v.colorFormat(dp));
    }

    crntD.setFullYear(crntD.getFullYear() + int[0]);
    crntD.setMonth(crntD.getMonth() + int[1]);
    crntD.setDate(crntD.getDate() + int[2]);
    table.push(row);
  }

  if (!args.flags.csv) {
    table.push([]);
    let avg = [];
    let rowL = table[table.length - 2].length;
    for (let i = 0;i < rowL;i++) {
      let j = i - (rowL - accounts.length);
      if (j < -1) {
        avg.push('');
      } else if (j == -1) {
        avg.push('Avg');
      } else {
        let acc = accounts[j];
        let v = acc.sum.divPrim(dateFunctions.length).tryConvertArgs(args);

        if (acc.q == cmd_report_accounts_compiled.income || acc.q == cmd_report_accounts_compiled.expense) {
          v = v.timesPrim(-1);
        }

        avg.push(v.colorFormat(isNaN(dp) ? 2 : dp));
      }
    }
    table.push(avg);


    console.log(`Reporting from ${c.bold(strF)} to ${c.bold(strT)}\n`);
  }

  console.log(tabulate(table, {
    align: align
  }));
}

async function cmd_stats(args) {
  let range = await fs_get_data_range();
  await data_open_books(range);

  let entries = 0;
  let totalSize = 0;

  let table = [['Stat', 'Data']];
  table.push(['File prefix',  fs_book_name]);
  table.push([]);

  let accs = {};
  let accounts = expand_account();

  for (let y of range) {
    let val = Object.values(data.books[y]).length;
    entries += val;
    let size = fs.statSync(`${fs_book_name}.${y}.ledg`).size / 1024;
    totalSize += size;
    size = Math.round(size * 100) / 100 + ' KiB';
    table.push([y, `${val} entries (${size})`]);
  }

  const countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};
  accounts.forEach(x => {
    let l = countDots(x);
    accs[l] = (accs[l] || 0) + 1;
  });

  totalSize = Math.round(totalSize * 100) / 100 + ' KiB';

  table.push(['Total entries', entries + ` (${totalSize})`]);
  table.push([]);

  Object.entries(accs).forEach(x => {
    table.push([`Level ${x[0]} accounts`, x[1]]);
  });

  table.push(['Total accounts', accounts.length]);
  table.push([]);

  table.push(['Flags', Object.entries(args.flags).map(x => {
    return (x[0].length == 1 ? '-' : '--') + x[0] + '=' + x[1]
  }).join(", ")]);
  table.push(['Modifiers', Object.entries(args.modifiers).map(x => x.join(":")).join(", ")]);



  console.log(tabulate(table));
}
async function cmd_modify(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';
  report_set_modifiers(args);
  //report_extract_account(args);

  let filteredEntries = [];
  await report_traverse(args, async function(entry) {
    filteredEntries.push(entry);
  });

  if (!filteredEntries.length) {
    console.log('No such entries found.');
    console.log('Modifiers are used for query, not modification. Use edit command to edit entry modifiers');
    return 1;
  }

  let mods_to_remove = (args.flags['remove-mod'] || '').split(",").filter(x => x != 'uuid' && x != 'time' && x != 'description' && x != 'transfers');
  let mods_to_set = (args.flags['set-mod'] || '').split(",");
  mods_to_set = argsparser(mods_to_set).modifiers;
  delete mods_to_set.uuid;
  delete mods_to_set.time;
  delete mods_to_set.description;
  delete mods_to_set.transfers;

  // =================================================
  //                     cmd_add
  // =================================================

  Object.assign(args.modifiers, mods_to_set);
  let opts = await cmd_add(args, true);
  if (typeof opts != 'object') return opts; // abnormal return code

  // =================================================
  //            ask for which ones to modify
  // =================================================
  let targetEntries = [];
  let skip = false;

  if (filteredEntries.length == 1) targetEntries.push(filteredEntries[0]);
  for (let i = targetEntries.length;i < filteredEntries.length;i++) {
    let e = filteredEntries[i];
    if (skip) { targetEntries.push(e); continue; }

    process.stdout.write(`Modify "${print_entry_title(e)}" (y/n/all/enter to abort)? `);
    let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
    if (args.flags.y) console.log('y');
    switch (ans) {
      case 'y':
      case 'yes':
        targetEntries.push(e);
        break;
      case 'n':
      case 'no':
        console.log('Skipped');
        break;
      case 'all':
        skip = true;
        targetEntries.push(e);
        break;
      default:
        console.log('Abort.');
        return 1;
    }
  }

  let tags_to_add = (args.flags['add-tag'] || '').split(",").map(x => x.toUpperCase()).filter(x => x && x.length);
  let tags_to_remove = (args.flags['remove-tag'] || '').split(",").map(x => x.toUpperCase()).filter(x => x && x.length);

  for (let e of targetEntries) {
    Object.assign(e, opts);
    mods_to_remove.forEach(x => delete e[x]);
    if (tags_to_add.length) {
      for (let tag of tags_to_add) {
        tag_add(e, tag);
      }
    }
    if (tags_to_remove.length) {
      for (let tag of tags_to_remove) {
        tag_remove(e, tag);
      }
    }
    await data_modify_entry(e);
  }

  console.log(`${targetEntries.length} entries are affected.`);
}
function cmd_git(args) {
  let argv = process.argv;
  let i = 1;
  while (++i < argv.length) {
    if (Object.keys(CMD_LIST).filter(x => x.indexOf(argv[i]) == 0).length == 1) break;
  }
  const ls = require('child_process').spawn("git", argv.slice(i + 1), {
    cwd: fs_get_book_directory(),
    stdio: 'inherit'
  });

  ls.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });

  ls.on("close", code => {
    process.exit(code);
  });
}
async function cmd_register(args) {
  args.modifiers.to = args.modifiers.to || '@tomorrow';

  let skipTo;
  args.flags['skip'] &&
     (skipTo = report_replaceDateStr(args.flags['skip'])) &&
     !isNaN(skipTo = Date.parse(skipTo + 'T00:00:00'));

  args.flags['hide-zero'] = args.flags['hide-zero'] !== false;
  args.flags['skip-book-close'] = args.flags['skip-book-close'] !== false;

  let depth = Number(args.flags['max-depth']) || Infinity;

  // defaults from:@min, to:@max
  let q = { queries: [query_args_to_filter(args, ['entries'])] };
  q.queries[0].collect = ['entries'];

  let data = (await query_exec(q))[0].entries;
  data = report_sort_by_time(data);

  let int = report_get_reporting_interval(args, true);

  if (!int)
    _cmd_register_nogroup(args, data, skipTo, depth);
  else
    _cmd_register_group(args, data, skipTo, depth, int, q.queries[0]);

}

function _cmd_register_group(args, data, skipTo, depth, int, q) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = Big.DP;

  let table = [['Start', 'Acc', 'Amnt', 'Tot']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

  let sum = new Money();

  let from = q.from * 1000;
  let to = q.to * 1000;

  let crntD = new Date(from);
  while (crntD < to) {
    let endDate = new Date(crntD);
    endDate.setFullYear(endDate.getFullYear() + int[0]);
    endDate.setMonth(endDate.getMonth() + int[1]);
    endDate.setDate(endDate.getDate() + int[2]);

    let accs = {};
    for (let i = 0;i < data.length;i++) {
      let e = data[i];
      if (e.time >= endDate / 1000 | 0 || e.time < crntD / 1000 | 0) continue;
      for (let q of args.accounts) {
        for (let t of e.transfers) {
          if (t[1].match(q)) {
            let a = print_truncate_account(t[1], depth);
            accs[a] = (accs[a] || new Money()).plus(t[2].tryConvertArgs(args, e.time));
          }
        }
      }
    }

    let j = -1;
    for (let acc in accs) {
      j++;
      let amnt = accs[acc];
      let row = j == 0 || args.flags.csv ?
            [ c.cyanBright(entry_datestr(crntD / 1000)) ] : [''];

      row.push(acc);

      let m = args.flags.invert ? amnt.timesPrim(-1) : amnt;
      sum = sum.plus(m);
      if (!skipTo || e.time * 1000 >= skipTo) {
        row.push(m.colorFormat(dp, true), sum.colorFormat(dp));
        table.push(row);
      }
    }

    if (j == -1 && !args.flags['hide-zero']) {
      table.push([
        c.cyanBright(entry_datestr(crntD / 1000)),
        '', new Money().colorFormat(), sum.colorFormat(dp)
      ]);
    }

    crntD = endDate;
  }

  console.log(tabulate(table, { align: align }));
}

function _cmd_register_nogroup(args, data, skipTo, depth) {
  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = Big.DP;

  let table = [['Date', 'UUID', 'Desc', 'Acc', 'Amnt', 'Tot']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

  let sum = new Money();

  for (let i = 0;i < data.length;i++) {
    let e = data[i];

    let j = 0;
    for (let q of args.accounts) {
      for (let t of e.transfers) {
        if (t[1].match(q)) {
          let row = j == 0 || args.flags.csv ?
                      [ c.cyanBright(entry_datestr(e)), c.cyan(e.uuid) ] : ['', ''];

          let desc = t[0] || (j++ == 0 ? e.description : '');
          desc = args.flags['light-theme'] ? c.black(desc) : c.whiteBright(desc);
          row.push(desc, print_truncate_account(t[1], depth));

          let m = args.flags.invert ? t[2].timesPrim(-1) : t[2];
          m = m.tryConvertArgs(args, e.time);
          sum = sum.plus(m);
          if (skipTo && e.time * 1000 < skipTo)
            continue;
          row.push(m.colorFormat(dp, true), sum.colorFormat(dp));
          table.push(row);
        }
      }
    }
  }

  console.log(tabulate(table, { align: align }));
}
async function cmd_benchmark(args) {
  if (args._[0] == 'test') {
    let m = Money.parseMoney('min -30, sec 29');
    console.log(m.convert('sec').toString());
    return;
  }
  let times = Number(args._[0]) || 100;
  for (let i = 0;i < times;i++) {
    data_init_data();
    await data_open_books(await fs_get_data_range());
  }
  console.log(_fs_entries_read + ' entries read');
}
async function cmd_export(args) {
  args.flags.csv = args.flags.csv !== false;
  let table;
  switch (args._[0]) {
    case 'gnucash-transactions':
      table = await cmd_export_gnucash_transactions(args);
      break;
    case 'gnucash-accounts':
      table = await cmd_export_gnucash_accounts(args);
      break;
    default:
      console.error(`'${args._[0]}' is not an export option.`);
      return 1;
  }
  console.log(tabulate(table));
}
async function cmd_count(args) {
  let q = { queries: [query_args_to_filter(args)] };
  q.queries[0].collect = ['count'];

  let data = await query_exec(q);

  let count = data[0].count;

  console.log((count).toString());
}

async function cmd_budget(args) {
  let budgetNames = Object.keys(data.budgets);

  if (args._.indexOf('edit') >= 0) {
    let path = fs_book_name + '.budgets.ledg';
    let EDITOR = process.env.EDITOR || 'vim';
    let args2 = EDITOR == 'vim' ? ['+autocmd BufRead,BufNewFile *.*.ledg setlocal ts=55 sw=55 expandtab! softtabstop=-1 nowrap listchars="tab:→\ ,nbsp:␣,trail:•,extends:⟩,precedes:⟨" list noautoindent nocindent nosmartindent indentexpr=', path] : [path];

    const ls = require('child_process').spawn(process.env.EDITOR || 'vim', args2, {
      cwd: fs_get_book_directory(),
      stdio: 'inherit'
    });
    return;
  } else if (args._.indexOf('list') >= 0) {
    let table = [['#', 'Budget']];
    let i = 0;
    for (let b of budgetNames) {
      table.push([++i, b]);
    }
    console.log('\n' + tabulate(table));
    return;
  }

  let mpart = args._.indexOf('partition') >= 0 || args._.indexOf('disk') >= 0;
  if (!budgetNames.length) {
    console.log(`Please create at least one budget at ${fs_book_name}.budgets.ledg`);
    return 1;
  }

  args.flags['skip-book-close'] = true;

  if (!args.flags.budget && budgetNames.length > 1) {
    let table = [['#', 'Budget']];
    let i = 0;
    for (let b of budgetNames) {
      table.push([++i, b]);
    }
    console.log('\n' + tabulate(table))
    process.stdout.write('Choose one: ');
    let ans = Math.max(Math.min(parseInt((await readline_prompt())) || 1, budgetNames.length), 0) - 1;
    console.log(`${ESC}[1AChoose one: ${c.green(budgetNames[ans])}`);
    args.flags.budget = budgetNames[ans];
  }
  let budget = data.budgets[args.flags.budget || budgetNames[0]];
  if (!budget) {
    console.log(`Specified budget "${args.flags.budget}" is not found.`);
    return 1;
  }

  if (args.flags['sum-parent'] === false) {
    args.flags['sum-parent'] = true;
    console.log("Warning: sum-parent is always enabled");
  }

  args.flags['max-depth'] = args.flags['max-depth'] || Infinity;
  let countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};

  args.modifiers.from = report_replaceDateStr(args.modifiers.from);
  args.modifiers.to = report_replaceDateStr(args.modifiers.to);
  // specified or budget dates
  let from = args.modifiers.from ? Date.parse(args.modifiers.from + 'T00:00:00') / 1000 | 0 : budget.from;
  let to = args.modifiers.to ? Date.parse(args.modifiers.to + 'T00:00:00') / 1000 | 0 : budget.to;

  // allow report_traverse to filter dates
  cmd_report_modifiers.from = args.modifiers.from = entry_datestr(from);
  cmd_report_modifiers.to = args.modifiers.to = entry_datestr(to);

  let period = to - from;
  let periodRemaining = Math.max(to - Math.max(from, new Date() / 1000 | 0), 0);
  let periodPassed = Math.min(to, new Date() / 1000 | 0) - from;
  if (new Date() / 1000 > to) {
    periodRemaining = period;
    periodPassed = 0;
  }
  let originalPeriod = budget.to - budget.from;
  let zoom = period / originalPeriod;
  let periodAltered = (from != budget.from) || (to != budget.to);
  if (periodAltered && !args.flags['do-not-adjust']) {
    console.log(`Due to custom time range, budget amounts had been adjusted by a factor of ${Math.round(zoom * 100) / 100}.`);
  }

  console.log('\n ' + c.bold(budget.description) + ` (${entry_datestr(budget.from)} to ${entry_datestr(budget.to)})` +
    (periodAltered ? ` => (${entry_datestr(from)} to ${entry_datestr(to)})` : '')
  );

  let table = [];

  function eta(a, b, x, reverse) {
//     let d = Math.max(b - a, b - x);
    let d = b - x; // remaining

    const DAY = 86400;
    const WEEK = 604800;
    const YEAR = DAY * 365;
    const MONTH = YEAR / 12;

    let avgPrd = [YEAR, 'yr', 'years'];

    if (period / 6 < WEEK || periodRemaining < WEEK) avgPrd = [DAY, 'd', 'days'];
    else if (period / 6 < MONTH || periodRemaining < MONTH) avgPrd = [WEEK, 'wk', 'weeks'];
    else if (period / 6 < YEAR || periodRemaining < YEAR) avgPrd = [MONTH, 'm', 'months'];

    let remainPrds = Math.round(periodRemaining / avgPrd[0] * 10) / 10;
    let prdsPsd = Math.round(periodPassed / avgPrd[0] * 10) / 10;

    let cRate = Math.round(x / prdsPsd * 100) / 100 || 0;
    let bRate = Math.round(d / remainPrds * 100) / 100 || 0;

    let perc = ((x / prdsPsd) - (d / remainPrds)) / (x / remainPrds);

    let color = c.yellowBright;
    if (Math.abs(perc) > 0.15)
      color = reverse ? (perc < 0 ? c.redBright : c.green) : (perc > 0 ? c.redBright : c.green);

    let et = d / (x / periodPassed) || 0;

    let etas = `${Math.ceil(et / DAY * 5) / 5} days`;
    if (et > YEAR) etas = `${Math.ceil(et / YEAR * 5) / 5} years`;
    else if (et > MONTH) etas = `${Math.ceil(et / MONTH * 5) / 5} months`;
    else if (et > WEEK) etas = `${Math.ceil(et / WEEK * 5) / 5} weeks`;

    if (et == Infinity) etas = '∞ years';
    if (et == -Infinity) etas = '-∞ years';

    let s = color(`${cRate == Infinity ? '∞' : cRate == -Infinity ? '-∞' : new Big(cRate).prec(4)}/${avgPrd[1]}`);
    return [[s, strip_ansi(s).length],
            `${bRate == Infinity ? '∞' : bRate == -Infinity ? '-∞' :  new Big(bRate).prec(4)}/${avgPrd[1]}`,
            etas
           ];
  }

  // ==============================================
  //                   trackers
  // ==============================================

  if (args.flags.simple)
    table.push(['Trackers', 'Budget', 'Used', 'Remain', 'Use%']);
  else
    table.push(['Trackers', '', 'Progress', '', 'Budget', 'Used', 'Remain', 'Use%', '  Rate', 'Rec  ', 'ETC  ']);
  for (let track of budget.trackers) {
    if (periodAltered && !args.flags['do-not-adjust']) {
      track = JSON.parse(JSON.stringify(track));
      track.high = Math.round(new Big(track.high).minus(track.low).times(zoom).plus(track.low).toNumber() * 100) / 100;
    }

    let args2 = argsparser(parseArgSegmentsFromStr(track.q));
    report_extract_account(args2);
    report_extract_tags(args2);

    let total = new Big(0);

    let ignored = Object.keys(cmd_report_modifiers);

    let regexMod = {};
    for (mod in args2.modifiers) {
      if (ignored.indexOf(mod) >= 0) continue;
      if (args2.modifiers[mod]) regexMod[mod] = new RegExp(args2.modifiers[mod], 'i');
    }
    await data_iterate_books(data_books_required(from * 1000, to * 1000), async function (book) {
      let len = book.length;
      WHILE: while (len--) {
        if ((book[len].time >= from) && (book[len].time < to)) {
          // skip all bookClose by force
          if (book[len].bookClose && book[len].bookClose.toString() == 'true') continue;
          for (mod in regexMod) {
            if (!book[len][mod]) {
              if (regexMod[mod].source == '(?:)') continue; // empty on both
              else continue WHILE;
            }
            if (regexMod[mod].source == '(?:)') continue;
            if (book[len][mod] && !(book[len][mod].toString()).match(regexMod[mod])) continue WHILE;
          }
          for (let q of args2.accounts) {
            for (let t of book[len].transfers) {
              if (t[1].match(q)) {
                total = total.plus(t[2]);
              }
            }
          }
        }
      }
    });

    let remain = new Big(track.high).minus(total).toNumber();
    total = total.toNumber();
    let title = ' ' + track.q + '  ';

    let usePerc = Math.round((total - track.low) / (track.high - track.low) * 100) + '%';
    let low = print_format_money(track.low);
    let high = print_format_money(track.high);

    if (args.flags.simple)
      table.push([
                  [c.yellowBright(title), title.length],
                  high,
                  print_format_money(total),
                  print_format_money(remain),
                  usePerc
                 ]);
    else
    table.push([
                [c.yellowBright(title), title.length],
                [c.cyan(low), low.length],
                [print_progress_bar(track.low, track.high, total, { reverseLowHigh: track.type == 'goal' }), 50],
                [c.cyan(high), high.length],
                [c.yellowBright(track.type.toUpperCase()), track.type.length],
                print_format_money(total),
                print_format_money(remain),
                usePerc,
                ...eta(track.low, track.high, total, track.type == 'goal')
               ]);
  }

  // ==============================================
  //                   budgets
  // ==============================================

  report_extract_account(args);
  report_extract_tags(args);


  let forkedBudgets = {};
  let disks = {};
  let baccs = Object.keys(budget.budgets).sort();
  // sum parent for budget
  baccs.forEach(x => {
    if (periodAltered && !args.flags['do-not-adjust']) {
      let high = budget.budgets[x];
      forkedBudgets[x] = forkedBudgets[x] || new Big(Math.round(new Big(high).times(zoom).toNumber() * 100) / 100);
    }
    forkedBudgets[x] = forkedBudgets[x] || new Big(budget.budgets[x]);
    let levels = x.split(".");
    let previous = "";
    for (let l of levels) {
      let k = previous + l;
      if (k == x) continue;
      forkedBudgets[k] = (forkedBudgets[k] || new Big(0)).plus(forkedBudgets[x]);
      previous = k + ".";
    }
  });
  let balanceData = await report_sum_accounts(args, true, forkedBudgets);
  for (let k in forkedBudgets) { forkedBudgets[k] = forkedBudgets[k].toNumber(); }
  if (mpart) {
    baccs.forEach(x => {
      let levels = x.split(".");
      let previous = "";
      for (let l of levels) {
        let k = previous + l;
        if (k.indexOf('.') < 0) {
          disks[k] = disks[k] || mpart_dsk_create(forkedBudgets[k]);
          disks[k].label = k;
        } else
          disks[k] = disks[k] || mpart_partition_create(disks[previous.replace(/\.$/, '')], { fixed: forkedBudgets[k], label: l });
        previous = k + ".";
      }
    });
    console.log(JSON.stringify(mpart_disks));
  }

  table.push([]);
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];
  if (args.flags.simple) {
    align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];
    table.push(['Accounts', 'Total', 'Used', 'Remain', 'Use%']);
  } else {
    table.push(['Accounts', '', 'Progress', '', 'Budget', 'Used', 'Remain', 'Use%', '  Rate', 'Rec  ', 'ETC  ']);
  }
  table[table.length - 1].header = true;

  let accTree = print_accountTree(baccs);
  accTree.list.forEach((x, i) => {
    let fullX = accTree.fullList[i];
    if (countDots(fullX) > args.flags['max-depth']) return;

    let name = x.match(/^([^a-z0-9]+)([a-z0-9].+)$/i)
    let row = [[name[1] + c.yellowBright(name[2]), x.length]];
    table.push(row);

    //if (baccs.indexOf(fullX) < 0) return;

    let total = forkedBudgets[fullX];
    let used = balanceData[fullX];
    let remain = new Big(total).minus(used).toNumber();
    let usePerc = Math.round(used / total * 100) + '%';
    let high = print_format_money(total);
    let et = eta(0, total, used);

    if (!args.flags.simple)
      row.push('', [print_progress_bar(0, total, used), 50]);
    if (!args.flags.simple)
      row.push([c.cyan(high), high.length]);
    else
      row.push(high);
    if (!args.flags.simple)
      row.push([c.yellowBright('LIMIT'), 5]);
    row.push(print_format_money(used));
    row.push(print_format_money(remain));
    row.push(usePerc);
    if (!args.flags.simple) {
      row.push(et[0], et[1], et[2]);
    }
  });

  /*
   "budgets": {
        "Expense": 300,
        "Expense.Other.Transportation": 300,
        "Expense.Essential.Groceries": 400,
        "Expense.Other.Education": 800,
        "Expense.Free.Retail.Tech": 1400
      },
      "*/
  console.log(tabulate(table, {
    align: align,
    colBorder: ' ',
    alternateColor: false
  }));


}
async function cmd_add(args, modifyMode=false) {
  let desc = [];
  let transfers = [];
  let currentTransfer = null;

  let opts = JSON.parse(JSON.stringify(args.modifiers));

  delete opts.uuid;
  delete opts.time;
  delete opts.from;
  delete opts.to;
  delete opts.description;

  args.flags.date = args.flags.date || args.flags.D;

  if (!modifyMode)
    opts.time = ((args.flags.date ? (Date.parse(report_replaceDateStr(args.flags.date) + 'T00:00:00') || new Date().getTime()) : new Date().getTime()) / 1000) | 0;

  Object.keys(opts).forEach(k => {
    if (typeof opts[k] == 'boolean') return;
    let n = Number(opts[k]);
    if (!isNaN(n)) opts[k] = n;
  });

  let _ = args._;

  for (let i = 0;i < _.length;i++) {
    let v = _[i].trim().replace(/ +/g, ' ');
    let num;
    try {
      num = Money.parseMoney(v);
    } catch (e) {}

    if (v.match(/^\d{4}-\d{2}-\d{2}$/)) {
      opts.time = ((Date.parse(report_replaceDateStr(v) + 'T00:00:00') / 1000) | 0) || opts.time;
    } else if (isArgAccount(v) && v.indexOf(' ') == -1) { // start account with category
      if (currentTransfer) { // start new one, commit old
        transfers.push(currentTransfer);
        currentTransfer = null;
        continue;
      }
      let accs = fzy_query_account(v, expand_account());
      currentTransfer = ['', null, 0];
      if (accs.length == 0) {
        process.stdout.write(`"${c.bold(v.replace(/\$/g, '').replace(/\!/g, ''))}" does not match any explicitly declared accounts. Continue?`);
        let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
        if (args.flags.y) console.log('y');
        if (ans == 'y' || ans == 'yes') {
          currentTransfer[1] = v.replace(/\$/g, '').replace(/\!/g, '');
        } else {
          console.log('Abort.');
          return 1;
        }
      } else if (accs.length == 1) {
        currentTransfer[1] = accs[0];
      } else {
        console.log(`Multiple accounts matched for: ${c.bold(v)}\n`);
        for (let j = 0;j < accs.length;j++) {
          console.log(`${j + 1} ${accs[j]}`);
        }
        process.stdout.write('\nChoose one: ');
        let ans = Math.max(Math.min(parseInt((await readline_prompt())) || 1, accs.length), 0) - 1;
        console.log(`${ESC}[1AChoose one: ${c.green(accs[ans])}`);
        currentTransfer[1] = accs[ans];
      }
    } else if (v.startsWith("+")) {
      tag_add(opts, v.substring(1));
    } else if (num) {
      if (currentTransfer) {
        currentTransfer[2] = num;
        transfers.push(currentTransfer);
        currentTransfer = null;
      } else // entry description
        desc.push(_[i].trim());
    } else {
      if (currentTransfer) // transfer description
        currentTransfer[0] = (currentTransfer[0] + ' ' + _[i].trim()).trim();
      else // entry description
        desc.push(_[i].trim());
    }
  }
  if (currentTransfer) transfers.push(currentTransfer);

  let entry = modifyMode ? entry_modify_create(desc.join(" "), transfers, opts) : entry_create(desc.join(" "), transfers, opts);
  if (entry.transfers)
    console.log("\n" + print_entry_ascii(entry));
  else {
    console.log(`${c.cyanBright(entry.time ? entry_datestr(entry.time) : '[date]')} ${c.yellowBright.bold(entry.description || '[title]')} ${c.cyan('[uuid]')}`);
    for (let key in entry) {
      if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
      console.log(c.green('  ;' + key + ':' + JSON.stringify(entry[key])));
    }
  }

  // empty
  if (transfers.length == 0 && !modifyMode) {
    console.log('Empty entry, abort.');
    return 1;
  }

  // handle imbalance
  if (transfers.filter(x => x[1] == data_acc_imb).length) {
    process.stdout.write(`Entry is imbalanced, continue? `);
    let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
    if (args.flags.y) console.log('y');
    if (ans != 'y' && ans != 'yes') {
      console.log('Abort.');
      return 1;
    }
  }

  if (modifyMode) return entry;
  await data_push_entry(entry);
  await fs_write_config();
  console.log('Entry added.');
}
async function cmd_version() {
  console.log(c.bold('ledg - version 0.7.2') + ' built for cli');
}

async function cmd_help() {
  await cmd_version();
  console.log(
`
**SYNOPSIS**
\t**ledg <command> [ <filter> ] [ <flags> ]**

**FLAGS**
\tPresets of flags can be saved at ~/.ledgrc

\t--file=FILE, -FFILE
\t\tDefault: book
\t\tif FILE="-", then ledg reads entries from stdin
\t\tset FILE as a prefix for ledg file locations:
\t\tex. --file=Documents/book will point to Documents/book.*.ledg

\t--light-theme, --lt
\t\tput this in your .ledgrc if your terminal has light background

\t--csv
\t\toutputs all tables in csv formats(some commands only)

\t--budget=NAME
\t\tthis can be used in your .ledgrc to point to a default budget
\t\tex. --budget="Monthly Budget"
\t\t    --budget="2023 Puero Rico Vacation Saving Goals"

\t--income=<account filter>, --expense=<account filter>, --equity=<account filter>
\t--asset=<account filter>, --liability=<account filter>
\t\tDefault: Income*, Expense*, Asset*, Liability*, Equity*
\t\tLet certain report commands to know what are the corresponding accounts

\t--skip-book-close[=false], --sbc
\t\tDefault: false
\t\tSkips all entries with bookClose:"true" or bookClose:true

**FILTER**
\t[ modifiers ] [ account filter, ...]
\ta set of arguments that filters entries

\tfrom:yyyy-mm-dd
\t\tlimit entries starting from this date(inclusive)

\tto:yyyy-mm-dd
\t\tlimit entries before this date(exclusive)

\t@min, @max, @year-start, @year-end, @tomorrow, @today, @month-start, @month-end
\t@last-year-today, @last-year
\t\tused in conjunction with from: and to:
\t\tex: "ledg info from:@min to:@max" queries everything in the book

\tmodifier:regex
\t\tqueries entries with modifiers that matches the regex
\t\tex: payee:"amazon|steam"
\t\t    tag:"pc|tablet"

\t\tshorthands:
\t\t\tdesc: => description:
\t\t\tf:    => from:
\t\t\tt:    => to:
\t\t\tbc:   => bookClose:

\t+TAG
\t\tappends TAG(,|$) to tags: modifier, if tags: is empty

\tuuid filter
\t\tuuids can be filtered with the uuid:A|B|C syntax or directly putting uuids as arguments

\taccount filter
\t\taccounts in ledg follow this format: name[.name...], and name can
\t\tONLY contain letters and numbers, and MUST contain at least one letter

\t\tledg support fuzzy search of account names
\t\t\tex: ..cash =~ Account.Current.Cash
\t\t\t    .cash =~ Account.Cash
\t\t\t    exp$ =~ Expense
\t\t\t    exp|inc.sl =~ Expense | Income.Salary
\t\t\t    exp. =~ Expense.*
\t\t\t    exp. =~ Expense.*
\t\t\t* - matches any character
\t\t\t. - matches . literally
\t\t\t    anything in between dots matches any segments of account names that
\t\t\tcontains the letters in that order
\t\t\t    ex: .csh. matches *\\.[^.]*c[^.]*s[^.]*h[^.]*\\.* in regex

**VIRTUAL ENTRIES**
\tEntries are virtual with virt:true modifier.
\tPass --real flag ignores these virtual entries.

**COMMANDS**
\tCommands can be shortened as long as they are not ambiguous
\tExample: ledg accounts -> ledg acc
\t\t\t ledg info -> ledg inf

\tedit <filters> [new]
\t\tbrings up system editor to modify filtered entries
\t\tnew
\t\t\topens a blank file to manually enter new entries

\taccounts add <full account name>
\t\tcreate new account and write to FILE.config.ledg

\tburndown [--q1="[<filters>] <account filters>", --q2=...] [--abs=false] [--count]
\t         [--cumulative]
\t\tCreates multi-dataset bar graphs
\t\tDefault: --abs=true

\t\t--abs
\t\t\tTake absolute values

\t\t--cumulative
\t\t\tcumulates count/sum

\t\t--count
\t\t\tShow graph of numbers of entries rather than sum

\tregister [--daily] [--weekly] [--biweekly] [--monthly] [--quarterly]
\t         [--yearly] [--hide-zero=true, --hz]
\t         [--skip-book-close=true] [--csv] [--invert]
\t         [ <account filter 1> <account filter 2> ... ] [--skip=]
\t\tDefault: --hide-zero to:@tomorrow from:@min
\t\tdisplays matched transferse with amounts and a running total.
\t\tWithout a reporting interval, individual transfers are shown
\t\tinstead of grouping together

\t\t--invert
\t\t\tnegates all amounts

\t\t--hide-zero, --hz
\t\t\tDefault: true
\t\t\thide rows that are zeroes when used with reporting interval

\t\t--skip=yyyy-mm-dd
\t\t\thides rows up until this date but keep cumulative sum from before

\t\t--csv
\t\t\ttabulate data in csv (exporting for other use)

\thistory [--daily] [--weekly] [--biweekly] [--monthly] [--quarterly]
\t        [--yearly] [--cumulative] [--cumulative-columns=num list]
\t        [--skip-book-close=true] [--epoch] [--csv] [--iso] [--invert]
\t        [ <account filter 1> <account filter 2> ... ] [--skip=]
\t\tDefaults: shows accounts specified by --income, --expense, --asset, --liability,
\t\t          and --equity, and defaults --skip-book-close=true
\t\tprints multicolumn time by selected interval
\t\tNote: even with cumulative columns, history command does not sum everything from
\t\t@min, and so unless from:@min is given, asset/liability calculation is not accurate

\t\t--invert
\t\t\tinvert every number

\t\t--cumulative-columns=1,2,3..., --cml-cols
\t\t\tshows cumulative data for the given column numbers

\t\t--cumulative, --cml
\t\t\tshows cumulative data

\t\t--skip=yyyy-mm-dd
\t\t\thides rows up until this date but keep cumulative sum from before

\t\t--epoch
\t\t\tshow timestamps in epoch

\t\t--csv
\t\t\ttabulate data in csv (exporting for other use)

\t\t--iso
\t\t\tshow timestamps in ISO date string

\taccounts rename <source> <dist> [ <filter> ]
\t\tmodifies entries by replacing account source with dist
\t\t-y
\t\t\tdefaults confirmations to yes

\taccounts [tree] [--sum-parent] [--hide-zero, --hz] [--max-depth=NUM, --dep, --depth]
\t\t[--sum] [ <filter> ] [--sort]
\t\tsums balances in selected accounts
\t\tDue to the need to sum entries from the beginning of a book, from: modifier is
\t\tdefaulted to @min.

\t\t--sort
\t\t\tunless in tree mode, sort accounts by amount in descending order

\t\t--sum-parent
\t\t\tallows child account balances to add to parent accounts
\t\t--hide-zero, --hide-zero=false, --hz
\t\t\thide accounts with zero balance or not
\t\t--max-depth=NUM, --depth, --dep
\t\t\tmax child account depth to show
\t\t--sum
\t\t\tsums listed accounts, best used with --max-depth=1
\t\ttree
\t\t\tdisplays account balances in tree view

\tinfo [ <filter> ] [flat]
\t\tdisplays entries' information

\t\tflat
\t\t\tdisplays entries row by row rather than expanding individual transfers

\ttags [--field="tags"]
\t\ttabulates tags with number of entries

\t\t--field=
\t\t\tdefault: tags
\t\t\tThis can be used on any fields such as description or payee

\tadd [--date=yyyy-mm-dd] [-y] [description] [yyyy-mm-dd] < <account filter>
\t\t  [account description] <amount> [, ...]> [+TAG ...]
\t\tpush entry to book
\t\tNote: The last account transfer set can leave empty amount, and ledg will calculate it.
\t\t  ex: "ledg add cash withdrawal from bank ast..cash 100 ast..BoA.chking"
\t\t      will leave Asset.Current.BankOfAmerica.Checking with -100 balance

\t\t<account filter>
\t\t\t(see FILTER section)

\t\t--date=yyyy-mm-dd, -Dyyyy-mm-dd, [yyyy-mm-dd]
\t\t\tDefault: current date
\t\t\tspecifies the date of entry
\t\t-y
\t\t\tdefaults most confirmations to yes (unless ledg prompts a list to choose)

\tmodify <filter> [--date=yyyy-mm-dd] [--add-tag=A,B,C] [-remove-tag=A,B,C]
\t       [--set-mod=A:123,B:123] [--remove-mod=C,D,E] [-y] [description] [+TAG ...]
\t       [yyyy-mm-dd] [ <account filter> [account description] <amount> [, ...]]
\t\tbatch modify entries, see more in "add" section
\t\taccount query is not supported
\t\tNote: using +TAG replaces everything. If only a new tag is needed, use --add-tag

\tdelete [ <filter> ] [-y]
\t\tbatch delete entries
\t\t-y
\t\t\tdefaults confirmations to yes

\tbudget [--budget=NAME] [--do-not-adjust] [edit|list] [--simple]
\t\tprints report for the selected budget
\t\tNote: report excludes entries with bookClose:"true"
\t\t      budgets can be edited at FILE.budgets.ledg

\t\t--simple
\t\t\tDisplays budget with simplified information

\t\t--do-not-adjust
\t\t\tBy default, if specified from: and to: have different range than the one in
\t\t\tbudget file, ledg will shrink/grow amounts correspondingly. For example,
\t\t\tfrom:@month-start and to:@month-end on an annual budget will divide all amounts
\t\t\tby 12. This option disables the feature.

\t\tedit
\t\t\topens system editor for FILE.budgets.ledg

\t\tlist
\t\t\tlists all budget names in FILE.budgets.ledg

\t\tExample book.budgets.ledg:
\t\t~ Vacation Budget 2021
\t\t  ;from:"@month-start"
\t\t;this is a comment, below are tracker based budgeting
\t\t  ;to:"@month-end"
\t\t  ast.*.Chck	goal 0-500
\t\t  exp.* payee:Amazon	limit 0--200

\t\t; -- account based budgeting --
\t\t  Expense	300
\t\t; -- expense cateogries --
\t\t  Expense.Other.Transportation	300
\t\t  Expense.Essential.Groceries	200

\tprint [<account filters>] [<filters>] [--ledger]
\t\tprints selected entries in ledg format
\t\tused in conjunction with -F-
\t\tex: ledg print lia..amazon | ledg -F- accounts exp..personalcare

\t\t--ledger
\t\t\tprints ledger & hledger compatible journal

\tgit [...]
\t\texecutes git [...] at the parent directory of FILE

\tstats
\t\tdisplays stats of journal files

\tcount [<account filters>] [<filters>]
\t\treturns number of entries that match the filters

\texport gnucash-transactions > transactions.csv
\texport gnucash-accounts > accounts.csv
\t\tcsv can be directly imported to gnucash
`.replace(/\*\*([^\n\r]+)\*\*/g, c.bold('$1')));

}

async function cmd_info(args) {
  report_extract_account(args);
  report_extract_tags(args);

  if (Object.keys(args.modifiers).length == 0 &&
      !args.accounts.length) {
    args.modifiers.from = '@month-start';
    args.modifiers.to = '@max';
    console.log(`No modifiers, using from:@month-start and to:@max\n`);
  } else {
    args.modifiers.from = args.modifiers.from || '@min';
    args.modifiers.to = args.modifiers.to || '@max';
  }

  let flat = args._[0] == 'flat';

  report_set_modifiers(args);

  let entries = [];
  await report_traverse(args, async function(entry) {
    entries.push(entry);
  });
  entries = report_sort_by_time(entries);

  if (flat) {
    report_set_accounts(args);
    report_compile_account_regex();

    let data = [['Date', 'UUID', 'Description', 'Account', 'Amount']];
    let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT];

    let colorFuncs = [x => c.cyanBright(x),
                      x => c.cyan(x),
                      args.flags['light-theme'] ? x => c.black(x) :
                                                  x => c.whiteBright(x),
                      x => c.yellowBright(x),
                      undefined
                     ];

    for (let e of entries) {
      let account;
      let desc = e.description + '        ';
      let amount = new Money();
      if (e.transfers.length <= 2) {
        for (let t of e.transfers) {
          if (t[1].match(cmd_report_accounts.expense)) {
            amount = t[2].timesPrim(-1);
            account = t[1];
            break;
          }
        }
        if (!account) {
          for (let t of e.transfers) {
            if (t[1].match(cmd_report_accounts.liability)) {
              amount = t[2].timesPrim(1);
              account = t[1];
              break;
            }
          }
          if (!account) {
            for (let t of e.transfers) {
              if (t[1].match(cmd_report_accounts.income)) {
                amount = t[2].timesPrim(-1);
                account = t[1];
                break;
              }
            }
          }
        }
      } else {
        let totalPosAmount = new Money();
        let expAmount = new Money();
        for (let t of e.transfers) {
          if (t[1].match(cmd_report_accounts.expense)) expAmount = expAmount.plus(t[2]);
          if (t[2] > 0) totalPosAmount = totalPosAmount.plus(t[2]);
        }
        totalPosAmount = totalPosAmount;
        expAmount = expAmount;
        if (totalPosAmount.eq(expAmount)) {
          amount = totalPosAmount.timesPrim(-1).colorFormat();
          account = '--- Split in ' + e.transfers.length + ' transfers ---';
        }
      }
      if (!account) {
        account = e.bookClose ? '=======  Book Close  ========' : '--- Split in ' + e.transfers.length + ' transfers ---';
        desc = e.bookClose ? '===== ' + e.description + '[' + e.transfers.length + ']' + ' =====' : desc;
        amount = new Money();
        for (let t of e.transfers) {
          if (t[2].gtr(new Money())) amount = amount.plus(t[2]);
        }
        amount = '±' + amount.noColorFormat();
        amount = c.cyanBright(amount);
      } else if (!amount.length) {
        amount = amount.colorFormat();
      }

      data.push([
        entry_datestr(e),
        e.uuid,
        desc,
        account,
        amount
      ]);
    }

    console.log(tabulate(data, {colorizeColCallback: colorFuncs, align: align}) + '\n');
  } else {
    let maxWidth = print_max_width_from_entries(entries);
    for (let e of entries) {
      console.log(print_entry_ascii(e, maxWidth));
    }
  }
}
async function cmd_tags(args) {
  let q = { queries: [query_args_to_filter(args, ['entries'])] };

  let data = (await query_exec(q))[0].entries;
  let tags = {};

  for (let e of data) {
    let tag = e[args.flags.field || 'tags'];
    if (!tag) continue;
    tag = tag.split(",");
    for (let t of tag) {
      tags[t] = (tags[t] + 1) || 1;
    }
  }

  tags = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  let table = [['Tag', 'Entries']];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT];

  for (let e of tags) {
    table.push(e);
  }

  console.log(tabulate(table, { align: align }))
}

async function cmd_print(args) {
  let q = { queries: [query_args_to_filter(args, ['entries'])] };

  report_sort_by_time((await query_exec(q))[0].entries).forEach(entry => {
    console.log(args.flags.ledger ? fs_serialize_entry_ledger(entry) : fs_serialize_entry(entry));
  });
}
async function cmd_delete(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';
  report_set_modifiers(args);
  report_extract_account(args);
  report_extract_tags(args);

  let filteredEntries = [];
  await report_traverse(args, async function(entry) {
    filteredEntries.push(entry);
  });

  if (!filteredEntries.length) {
    console.log('No such entries found.');
    return 1;
  }

  let targetEntries = [];
  let skip = false;

  for (let i = 0;i < filteredEntries.length;i++) {
    let e = filteredEntries[i];
    if (skip) { targetEntries.push(e); continue; }

    process.stdout.write(`Delete "${print_entry_title(e)}" (y/n/all/enter to abort)? `);
    let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
    if (args.flags.y) console.log('y');
    switch (ans) {
      case 'y':
      case 'yes':
        targetEntries.push(e);
        break;
      case 'n':
      case 'no':
        console.log('Skipped');
        break;
      case 'all':
        skip = true;
        targetEntries.push(e);
        break;
      default:
        console.log('Abort.');
        return 1;
    }
  }

  for (let e of targetEntries) {
    await data_remove_entry(e);
  }

  console.log(`${targetEntries.length} entries are affected.`);
}

async function cmd_edit(args) {
  args.modifiers.from = args.modifiers.from || '@min';
  args.modifiers.to = args.modifiers.to || '@max';

  report_set_modifiers(args);
  report_extract_account(args);
  report_extract_tags(args);

  let content = '';

  if (args._[0] != 'new') {
    await report_traverse(args, async function(entry) {
      content += fs_serialize_entry(entry) + '\n';
    });
  }

  let path = fs_get_book_directory() + '/~temp.edit.ledg';
  fs.writeFileSync(path, content);

  let EDITOR = process.env.EDITOR || 'vim';
  let args2 = EDITOR == 'vim' ? ['+autocmd BufRead,BufNewFile *.*.ledg setlocal ts=55 sw=55 expandtab! softtabstop=-1 nowrap listchars="tab:→\ ,nbsp:␣,trail:•,extends:⟩,precedes:⟨" list noautoindent nocindent nosmartindent indentexpr=', path] : [path];

  const ls = require('child_process').spawn(process.env.EDITOR || 'vim', args2, {
    cwd: fs_get_book_directory(),
    stdio: 'inherit'
  });

  ls.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });

  async function callback(code) {
    content = fs.readFileSync(path).toString();
    fs.unlinkSync(path);

    if (code != 0) {
      console.log(`error: editor returned with code ${code}`);
      process.exit(code);
      return;
    }

    let newEntries = 0;
    let affectedEntries = 0;

    let entries = fs_read_entries_from_string(content);
    for (let entry of entries) {
      if (!(await data_modify_entry(entry))) { // new entry
        process.stdout.write(print_entry_ascii(entry) + '\nCreate the above new entry? ');
        let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
        if (args.flags.y) console.log('y');
        if (ans == 'y' || ans == 'yes') {
          // fixes issue with new entry overwrites everything in a book
          //
          // fs_read_entries_from_string() marks book as opened
          let y = new Date(entry.time * 1000).getFullYear();
          delete data.booksOpened[y];

          await data_push_entry(entry);
          newEntries++;
        } else {
          console.log('Discarded 1 entry.');
        }
      } else affectedEntries++;
    }

    await fs_write_books();
    console.log(`Updated ${affectedEntries} entries and created ${newEntries} entries.`);
    process.exit(code);
  }

  ls.on("close", code => {
    callback(code);
  });
}
async function cmd_accounts(args) {
  // ===============================================================
  //                           add accounts
  // ===============================================================
  if (args._[0] == 'add') {
    let i = 1;
    for (;i < args._.length;i++) {
      let acc = args._[i];
      data.accounts[acc] = 1;
    }
    await fs_write_config();
    console.log(`Saved ${i - 1} account names to ` + fs_book_name + '.config.ledg');
    return;
  }

  // ===============================================================
  //                          rename accounts
  // ===============================================================
  if (args._[0] == 'rename') {
    let source = args._[1];
    let dst = args._[2];

    args.modifiers.from = args.modifiers.from || '@min';
    args.modifiers.to = args.modifiers.to || '@max';
    report_set_modifiers(args);

    let filteredEntries = [];
    await report_traverse(args, async function(entry) {
      for (let t of entry.transfers) {
        if (t[1].match(source)) {
          filteredEntries.push(entry);
          break;
        }
      }
    });

    let targetEntries = [];
    let skip = false;

    if (filteredEntries.length == 1) targetEntries.push(filteredEntries[0]);
    for (let i = targetEntries.length;i < filteredEntries.length;i++) {
      let e = filteredEntries[i];
      if (skip) { targetEntries.push(e); continue; }

      process.stdout.write(`Modify "${print_entry_title(e)}" (y/n/all/enter to abort)? `);
      let ans = args.flags.y ? 'y' : (await readline_prompt()).toLowerCase();
      if (args.flags.y) console.log('y');
      switch (ans) {
        case 'y':
        case 'yes':
          targetEntries.push(e);
          break;
        case 'n':
        case 'no':
          console.log('Skipped');
          break;
        case 'all':
          skip = true;
          targetEntries.push(e);
          break;
        default:
          console.log('Abort.');
          return 1;
      }
    }

    for (let e of targetEntries) {
      for (let t of e.transfers) {
        t[1] = t[1].replace(source, dst);
      }
      await data_modify_entry(e);
    }

    await fs_write_config();
    console.log('Saved to ' + fs_book_name + '.config.ledg');
    return;
  }


  // ===============================================================
  //                         sum up accounts
  // ===============================================================

  if (args.modifiers.from && args.modifiers.from.length) {
    console.log("Warning: using from modifier might result in wrong summation of asset and liability accounts\n");
  }

  let dp = Math.max(parseInt(args.flags.dp), 0);
  if (isNaN(dp)) dp = undefined;
  let tree = args._[0] == 'tree';

  if (args.flags['sum-parent'] === false && args.flags['max-depth']) {
    args.flags['sum-parent'] = true;
    console.log("Warning: with max-depth, sum-parent is always enabled");
  } else if (args.flags['max-depth'] && !tree) {
    args.flags['sum-parent'] = true;
    console.log("sum-parent is enabled with max-depth set");
  }

  args.flags['max-depth'] = args.flags['max-depth'] || Infinity;
  let countDots = (s) => {let m = s.match(/\./g); return m ? m.length + 1 : 1};

  let sumParent = !!args.flags['sum-parent'];
  if (sumParent && args.flags.sum && args.flags['max-depth'] == Infinity) {
    console.log("Warning: With --sum-parent and no --max-depth, --sum might produce wrong results.\n");
  }
  let max_t = fs_data_range.length ? Date.parse((fs_data_range[fs_data_range.length - 1] + 1) + '-01-01T00:00:00') : new Date(new Date().getFullYear() + 1, 0, 1) - 1000;
  let to = (Date.parse(report_replaceDateStr(cmd_report_modifiers.to) + 'T00:00:00') - 1000 || max_t) / 1000 | 0;

  report_extract_account(args);
  report_extract_tags(args);
  let balanceData = await report_sum_accounts(args, sumParent);
  let accounts = Object.keys(balanceData);

  let table = [["Accounts", "Balance"]];
  let align = [TAB_ALIGN_LEFT, TAB_ALIGN_RIGHT];

  let sum = new Money();

  let accs = accounts.sort((a, b) =>
    args.flags['sort'] ?
      balanceData[b].compare(balanceData[a]) :
      b - a
  ); // wait for open book then key

  if (tree) {
    if (args.flags['hide-zero'])
      accounts = accounts.filter(x => !balanceData[x].isZero());
    let accTree = print_accountTree(accounts);

    let i = -1;
    accTree.list.forEach((x) => {
      let fullAcc = accTree.fullList[++i];
      //if (args.flags['hide-zero'] && balanceData[fullAcc].isZero()) return;
      if (countDots(fullAcc) > args.flags['max-depth']) return;
      let amnt = balanceData[fullAcc] || new Money();
      if (amnt) sum = sum.plus(amnt);
      table.push([x, amnt.tryConvertArgs(args, to || undefined).colorFormat(dp)]);
    });
  } else {
    accs.forEach((x) => {
      if (args.flags['hide-zero'] && balanceData[x].isZero()) return;
      if (countDots(x) > args.flags['max-depth']) return;
      if (balanceData[x]) sum = sum.plus(balanceData[x]);
      table.push([x, balanceData[x].tryConvertArgs(args, to || undefined).colorFormat(dp)]);
    });
  }
  if (args.flags.sum)
    table.push(['Sum', sum.tryConvertArgs(args, to || undefined).colorFormat(dp)]);
  console.log(tabulate(table, { align: align }));
}
var mpart_disks = [];

function mpart_dsk_create(size) {
  let part = mpart_partition_create(null, {size: size, label: "Disk " + mpart_disks.length});
  mpart_disks.push(part);
  return part;
}

function mpart_partition_create(parent, props) {
  let part = {
    fixed: null, // ex. fixed $500 expenditure
    minFixed: null,
    maxFixed: null,
    absolutePerc: null, // ex. a saving fund will always take 10% from income
    minAbsolutePerc: null,
    maxAbsolutePerc: null,
    partitions: [],
    unallocated: 0,
    size: 0,
    label: 'Unnamed partition',
    color: randomColor({luminosity: 'light'})
  };

  // if (!props || (isNaN(props.fixed) && isNaN(props.absolutePerc))) {
  //   part.fixed = parent.unallocated;
  // }

  Object.assign(part, props);
  mpart_size_partition(part);

  if (!parent) return part;
  parent.partitions.push(part);
  mpart_size_partition(parent);
  return part;
}

function mpart_size_not_enough(disk, alloc) {
  let delta = alloc - disk.unallocated;
  //confirm(`Not enough space. Raise ${disk.label} from ${format_size(disk.size)} to ${format_size(disk.size + delta)}?`)
  if (true) {

    disk.unallocated += delta;
    disk.size += delta;

    disk.unallocated = Math.round(disk.unallocated * 100) / 100;
    disk.size = Math.round(disk.size * 100) / 100;
  } else {
    throw 'Not enough space.';
  }
}

function mpart_size_partition(disk) {
  for (let i = 0;i < disk.partitions.length;i++) {
    let part = disk.partitions[i];
    part.size = 0;
  }
  disk.unallocated = disk.size;
  /*
  Order:
  - fixed
  - absolute perc
  - rest is divided
  */
  for (let i = 0;i < disk.partitions.length;i++) {
    let part = disk.partitions[i];
    if (!part.fixed || part.size) continue;

    let max = Math.min(part.maxFixed || Infinity, (part.maxAbsolutePerc || Infinity) * disk.size / 100);
    let min = Math.max(part.minFixed || 0, (part.minAbsolutePerc || 0) * disk.size / 100);

    part.size = disk.unallocated;
    let calc = Math.round(Math.min(max, Math.max(min, part.fixed))  * 100) / 100;
    if (calc > disk.unallocated) mpart_size_not_enough(disk, calc);

    part.size = calc;
    disk.unallocated -= part.size;
  }
  disk.unallocated = Math.round(disk.unallocated * 100) / 100;
  for (let i = 0;i < disk.partitions.length;i++) {
    let part = disk.partitions[i];
    if (!part.absolutePerc || part.size) continue;

    let max = Math.min(part.maxFixed || Infinity, (part.maxAbsolutePerc || Infinity) * disk.size / 100);
    let min = Math.max(part.minFixed || 0, (part.minAbsolutePerc || 0) * disk.size / 100);

    part.size = disk.unallocated;
    let calcSize = Math.round(Math.min(max, Math.max(min, disk.size * part.absolutePerc / 100))  * 100) / 100;
    if (calcSize > disk.unallocated) mpart_size_not_enough(disk, calcSize);

    part.size = calcSize;
    disk.unallocated -= part.size;
  }
  disk.unallocated = Math.round(disk.unallocated * 100) / 100;

  let remainingUnallocated = disk.unallocated;
  let leftOverParts = 0;

  for (let i = 0;i < disk.partitions.length;i++) {
    let part = disk.partitions[i];
    if (!part.size) leftOverParts++;
  }
  for (let i = 0;i < disk.partitions.length;i++) {
    let part = disk.partitions[i];
    if (part.size) continue;

    let max = Math.min(part.maxFixed || Infinity, (part.maxAbsolutePerc || Infinity) * disk.size / 100);
    let min = Math.max(part.minFixed || 0, (part.minAbsolutePerc || 0) * disk.size / 100);

    part.size = disk.unallocated;
    let calcSize = Math.round(Math.min(max, Math.max(min, remainingUnallocated / leftOverParts))  * 100) / 100;
    if (calcSize > disk.unallocated) mpart_size_not_enough(disk, calcSize);

    part.size = calcSize;
    disk.unallocated -= part.size;
  }
  remainingUnallocated = disk.unallocated;
  leftOverParts = 0;

  for (let i = 0;i < disk.partitions.length;i++) {
    let part = disk.partitions[i];
    if (!part.absolutePerc && !part.fixed && !(part.maxFixed || part.maxAbsolutePerc)) leftOverParts++;
  }
  for (let i = 0;i < disk.partitions.length && leftOverParts && remainingUnallocated;i++) {
    let part = disk.partitions[i];
    if (part.absolutePerc || part.fixed || part.maxFixed || part.maxAbsolutePerc) continue;

    let min = Math.max(part.minFixed || 0, (part.minAbsolutePerc || 0) * disk.size / 100);

    let calcSize = Math.round(Math.max(min, part.size + remainingUnallocated / leftOverParts)  * 100) / 100;

    part.size = calcSize;
    disk.unallocated -= part.size;
  }

  disk.partitions.forEach(part => {
    mpart_size_partition(part);
  });
}

/*
 * `data` structure:
 * [
 *   [[text, realWidth], [text, realWidth], header: true],
 *   [[text, realWidth], [text, realWidth]],
 * ]
 */
function tabulate(data, opts) {
  if (!data.length) return;

  let def = {
    maxWidths: new Array(data[0].length).fill(Infinity),
    minWidths: new Array(data[0].length).fill(0),
    align: new Array(data[0].length).fill(TAB_ALIGN_LEFT),
    colBorder: '  ',
    rowBorder: undefined,
    alternateColor: true,
    firstRowIsHeader: true,
    colorizeColCallback: new Array(data[0].length)
  };
  Object.assign(def, opts);
  opts = def;

  if (cli_args.flags.csv || (opts && opts.csv)) {
    let width = data[0].length;
    return data.map(row => Array(width).fill('').map((x, i) => {
      let col = row[i] || '';
      return '"' + strip_ansi((typeof col == 'object' && col.length) ? col[0].toString() : col.toString()).trim().replace(/\"/g, "\"\"") + '"';
    }).join(",")).join("\n");
  }

  if (opts.firstRowIsHeader && data[0].header !== false) data[0].header = true;

  let _longestWidths = Array.from(opts.minWidths);
  for (let i = 0;i < data.length;i++) {
    let row = data[i];
    for (let j = 0;j < row.length;j++) {
      if (typeof row[j] != 'object') {
        row[j] = [(row[j]).toString(), strip_ansi((row[j]).toString()).length];
      }
      let realWidth = row[j][1];
      _longestWidths[j] = Math.min(opts.maxWidths[j], Math.max(_longestWidths[j], realWidth));
    }
  }

  let content = '';

  for (let i = 0;i < data.length;i++) {
    let row = data[i];
    let rowData = '';
    for (let j = 0;j < row.length;j++) {
      let col = row[j][0];

      let colWidth = _longestWidths[j];
      // truncate only plaintext
      if(row[j][1] == col.length && row[j][1] > colWidth) col = col.substring(0, 4);
      // align
      if (row[j][1] < colWidth) {
        if (opts.align[j] == TAB_ALIGN_LEFT) {
          col = print_pad_right(col, colWidth, row[j][1]);
        } else if (opts.align[j] == TAB_ALIGN_CENTER) {
          col = print_pad_left(col, row[j][1] + Math.floor((colWidth - row[j][1]) / 2), row[j][1]);
          col = print_pad_right(col, colWidth, row[j][1]);
        } else {
          col = print_pad_left(col, colWidth, row[j][1]);
        }
      }

      if (!row.header && opts.colorizeColCallback[j]) col = opts.colorizeColCallback[j](col, i, j);

      if (j + 1 < row.length) col += opts.colBorder;
      rowData += col;
    }
    if (row.header) rowData = c.underline(rowData);
    if (opts.alternateColor) rowData = print_alternate_row(rowData, i);
    content += rowData + "\n";
    if (opts.rowBorder) content += new Array(rowData.length).fill(opts.rowBorder) + "\n";
  }

  return content;
}

var TAB_ALIGN_LEFT = 1;
var TAB_ALIGN_RIGHT = 2;
var TAB_ALIGN_CENTER = 3;

function print_entry_ascii(entry, maxWidth) {
  maxWidth = maxWidth || print_max_width_from_entries([entry]);
  let alignrightwidth = 2 + maxWidth.transDesc + (maxWidth.transDesc ? 2 : 0) + maxWidth.acc + 2 + maxWidth.mon - 9 - 10 - (entry.description ? entry.description.length : 0);
  let str = c.cyanBright.bold(entry.time ? entry_datestr(entry) : '[time]') + ' ' + (typeof entry.description == 'string' ? entry.description : '[title]').trim() +
            Array(Math.max(alignrightwidth, maxWidth.desc + 2 - (entry.description ? entry.description.length : 0))).fill(' ').join('') + c.cyan(entry.uuid ? (' #' + (entry.uuid)) : ' [uuid]');
  for (let key in entry) {
    if (key == 'description' || key == 'time' || key == 'uuid' || key == 'transfers') continue;
    str += c.green('\n  ;' + key + ':' + JSON.stringify(entry[key]));
  }
  str += '\n';
  for (let t of entry.transfers) {
    let mon = t[2].noColorFormat();
    str += '  ' +
           (maxWidth.transDesc ? t[0] + Array(maxWidth.transDesc - t[0].length + 2).fill(' ').join('') : '') +
           c.yellowBright(t[1] + Array(maxWidth.acc - t[1].length + 2).fill(' ').join('')) +
           Array(maxWidth.mon - mon.length + 2).fill(' ').join('') + t[2].colorFormat() + '\n';
  }
  return str;
}

function print_entry_title(entry) {
  return c.cyanBright(entry_datestr(entry)) + ' ' + c.yellowBright.bold(entry.description.trim()) + c.cyan(' #' + entry.uuid);
}

function print_header_style(str) {
  return c.underline(str);
}

function print_alternate_row(row, i) {
  if (cli_args.flags['light-theme'])
    return i % 2 ? `${ESC}[48;5;255m${(row)}${ESC}[49m` : row;
  return i % 2 ? `${ESC}[48;5;234m${(row)}${ESC}[49m` : row;
}

function print_pad_right(str, num, len) {
  if ((len || str.length) >= num) return str;
  return str + Array(1 + num - (len || str.length)).join(' ');
}
function print_pad_left(str, num, len) {
  if ((len || str.length) >= num) return str;
  return Array(1 + num - (len || str.length)).join(' ') + str;
}

function print_max_width_from_entries(entries) {
  let a = { transDesc: 0, desc: 0, acc: 0, mon: 0 };
  let len = entries.length;
  while (len--) {
    let e = entries[len];
    a.desc = Math.max(a.desc, e.description ? e.description.length : 0);

    let len2 = e.transfers.length;
    while (len2--) {
      a.transDesc = Math.max(a.transDesc, e.transfers[len2][0].length);
      a.acc = Math.max(a.acc, e.transfers[len2][1].length);
      a.mon = Math.max(a.mon, e.transfers[len2][2].noColorFormat().length);
    }
  }
  return a;
}

/* Deprecated
function print_format_money(m) {
  return accounting.formatMoney(m);
}
*/

function print_truncate_account(acc, depth) {
  let a = acc.split('.');
  a.length = Math.min(Math.max(depth, 0), a.length);
  return a.join('.');
}

function print_color_money(m, plus) {
  if (m < 0)
    return c.redBright(print_format_money(m));
  if (m > 0)
    return c.green((plus ? '+' : '') + print_format_money(m));
  return print_format_money(m);
}

function print_progress_bar(a, b, x, opts) {
  opts = opts || {};
  let def = { width: 50, colorThisString: null, colorizeLow: c.bgGreen, colorizeMid: c.bgYellow, colorizeHigh: c.bgRed, reverseLowHigh: false };
  Object.assign(def, opts);
  opts = def;

  let perc = Math.max(Math.min((x-a) / (b-a), 1), 0);
  let bar = Math.round(perc * opts.width);
  let bg = opts.width - bar;

  let colorBar = opts.reverseLowHigh ? (perc < 0.15 ? opts.colorizeHigh : (perc > 0.85 ? opts.colorizeLow : opts.colorizeMid))
                                 :(perc < 0.65 ? opts.colorizeLow : (perc > 0.9 ? opts.colorizeHigh : opts.colorizeMid));
  if (opts.colorThisString) {
    return colorBar(opts.colorThisString);
  }

  let str = colorBar(new Array(bar).fill(' ').join('')) +
            (cli_args.flags['light-theme'] ?  `${ESC}[48;5;255m` : `${ESC}[48;5;234m` ) +
            (new Array(bg).fill(' ').join('')) + `${ESC}[49m`;

  return str;
}

const print_monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
  ];
const print_quarterNames = ["First", "Second", "Third", "Fourth"];
function print_full_month(m) {
  return print_monthNames[m];
}

function print_full_quarter(m) {
  return print_quarterNames[m / 3 | 0];
}

function pring_week(d) {
  var onejan = new Date(d.getFullYear(),0,1);
  var today = new Date(d.getFullYear(),d.getMonth(),d.getDate());
  var dayOfYear = ((today - onejan + 86400000)/86400000);
  return Math.ceil(dayOfYear/7)
};
// randomColor by David Merfield under the CC0 license
// https://github.com/davidmerfield/randomColor/

// Seed to get repeatable colors
var seed = null;

// Shared color dictionary
var colorDictionary = {};

// Populate the color dictionary
loadColorBounds();

// check if a range is taken
var colorRanges = [];

function randomColor (options) {

  options = options || {};

  // Check if there is a seed and ensure it's an
  // integer. Otherwise, reset the seed value.
  if (options.seed !== undefined && options.seed !== null && options.seed === parseInt(options.seed, 10)) {
    seed = options.seed;

  // A string was passed as a seed
  } else if (typeof options.seed === 'string') {
    seed = stringToInteger(options.seed);

  // Something was passed as a seed but it wasn't an integer or string
  } else if (options.seed !== undefined && options.seed !== null) {
    throw new TypeError('The seed value must be an integer or string');

  // No seed, reset the value outside.
  } else {
    seed = null;
  }

  var H,S,B;

  // Check if we need to generate multiple colors
  if (options.count !== null && options.count !== undefined) {

    var totalColors = options.count,
        colors = [];
    // Value false at index i means the range i is not taken yet.
    for (var i = 0; i < options.count; i++) {
      colorRanges.push(false)
      }
    options.count = null;

    while (totalColors > colors.length) {

      var color = randomColor(options);

      if (seed !== null) {
        options.seed = seed;
      }

      colors.push(color);
    }

    options.count = totalColors;

    return colors;
  }

  // First we pick a hue (H)
  H = pickHue(options);

  // Then use H to determine saturation (S)
  S = pickSaturation(H, options);

  // Then use S and H to determine brightness (B).
  B = pickBrightness(H, S, options);

  // Then we return the HSB color in the desired format
  return setFormat([H,S,B], options);
};

function pickHue(options) {
  if (colorRanges.length > 0) {
    var hueRange = getRealHueRange(options.hue)

    var hue = randomWithin(hueRange)

    //Each of colorRanges.length ranges has a length equal approximatelly one step
    var step = (hueRange[1] - hueRange[0]) / colorRanges.length

    var j = parseInt((hue - hueRange[0]) / step)

    //Check if the range j is taken
    if (colorRanges[j] === true) {
      j = (j + 2) % colorRanges.length
    }
    else {
      colorRanges[j] = true
         }

    var min = (hueRange[0] + j * step) % 359,
        max = (hueRange[0] + (j + 1) * step) % 359;

    hueRange = [min, max]

    hue = randomWithin(hueRange)

    if (hue < 0) {hue = 360 + hue;}
    return hue
  }
  else {
    var hueRange = getHueRange(options.hue)

    hue = randomWithin(hueRange);
    // Instead of storing red as two seperate ranges,
    // we group them, using negative numbers
    if (hue < 0) {
      hue = 360 + hue;
    }

    return hue;
  }
}

function pickSaturation (hue, options) {

  if (options.hue === 'monochrome') {
    return 0;
  }

  if (options.luminosity === 'random') {
    return randomWithin([0,100]);
  }

  var saturationRange = getSaturationRange(hue);

  var sMin = saturationRange[0],
      sMax = saturationRange[1];

  switch (options.luminosity) {

    case 'bright':
      sMin = 55;
      break;

    case 'dark':
      sMin = sMax - 10;
      break;

    case 'light':
      sMax = 55;
      break;
 }

  return randomWithin([sMin, sMax]);

}

function pickBrightness (H, S, options) {

  var bMin = getMinimumBrightness(H, S),
      bMax = 100;

  switch (options.luminosity) {

    case 'dark':
      bMax = bMin + 20;
      break;

    case 'light':
      bMin = (bMax + bMin)/2;
      break;

    case 'random':
      bMin = 0;
      bMax = 100;
      break;
  }

  return randomWithin([bMin, bMax]);
}

function setFormat (hsv, options) {

  switch (options.format) {

    case 'hsvArray':
      return hsv;

    case 'hslArray':
      return HSVtoHSL(hsv);

    case 'hsl':
      var hsl = HSVtoHSL(hsv);
      return 'hsl('+hsl[0]+', '+hsl[1]+'%, '+hsl[2]+'%)';

    case 'hsla':
      var hslColor = HSVtoHSL(hsv);
      var alpha = options.alpha || Math.random();
      return 'hsla('+hslColor[0]+', '+hslColor[1]+'%, '+hslColor[2]+'%, ' + alpha + ')';

    case 'rgbArray':
      return HSVtoRGB(hsv);

    case 'rgb':
      var rgb = HSVtoRGB(hsv);
      return 'rgb(' + rgb.join(', ') + ')';

    case 'rgba':
      var rgbColor = HSVtoRGB(hsv);
      var alpha = options.alpha || Math.random();
      return 'rgba(' + rgbColor.join(', ') + ', ' + alpha + ')';

    default:
      return HSVtoHex(hsv);
  }

}

function getMinimumBrightness(H, S) {

  var lowerBounds = getColorInfo(H).lowerBounds;

  for (var i = 0; i < lowerBounds.length - 1; i++) {

    var s1 = lowerBounds[i][0],
        v1 = lowerBounds[i][1];

    var s2 = lowerBounds[i+1][0],
        v2 = lowerBounds[i+1][1];

    if (S >= s1 && S <= s2) {

       var m = (v2 - v1)/(s2 - s1),
           b = v1 - m*s1;

       return m*S + b;
    }

  }

  return 0;
}

function getHueRange (colorInput) {

  if (typeof parseInt(colorInput) === 'number') {

    var number = parseInt(colorInput);

    if (number < 360 && number > 0) {
      return [number, number];
    }

  }

  if (typeof colorInput === 'string') {

    if (colorDictionary[colorInput]) {
      var color = colorDictionary[colorInput];
      if (color.hueRange) {return color.hueRange;}
    } else if (colorInput.match(/^#?([0-9A-F]{3}|[0-9A-F]{6})$/i)) {
      var hue = HexToHSB(colorInput)[0];
      return [ hue, hue ];
    }
  }

  return [0,360];

}

function getSaturationRange (hue) {
  return getColorInfo(hue).saturationRange;
}

function getColorInfo (hue) {

  // Maps red colors to make picking hue easier
  if (hue >= 334 && hue <= 360) {
    hue-= 360;
  }

  for (var colorName in colorDictionary) {
     var color = colorDictionary[colorName];
     if (color.hueRange &&
         hue >= color.hueRange[0] &&
         hue <= color.hueRange[1]) {
        return colorDictionary[colorName];
     }
  } return 'Color not found';
}

function randomWithin (range) {
  if (seed === null) {
    //generate random evenly destinct number from : https://martin.ankerl.com/2009/12/09/how-to-create-random-colors-programmatically/
    var golden_ratio = 0.618033988749895
    var r=Math.random()
    r += golden_ratio
    r %= 1
    return Math.floor(range[0] + r*(range[1] + 1 - range[0]));
  } else {
    //Seeded random algorithm from http://indiegamr.com/generate-repeatable-random-numbers-in-js/
    var max = range[1] || 1;
    var min = range[0] || 0;
    seed = (seed * 9301 + 49297) % 233280;
    var rnd = seed / 233280.0;
    return Math.floor(min + rnd * (max - min));
}
}

function HSVtoHex (hsv){

  var rgb = HSVtoRGB(hsv);

  function componentToHex(c) {
      var hex = c.toString(16);
      return hex.length == 1 ? '0' + hex : hex;
  }

  var hex = '#' + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);

  return hex;

}

function defineColor (name, hueRange, lowerBounds) {

  var sMin = lowerBounds[0][0],
      sMax = lowerBounds[lowerBounds.length - 1][0],

      bMin = lowerBounds[lowerBounds.length - 1][1],
      bMax = lowerBounds[0][1];

  colorDictionary[name] = {
    hueRange: hueRange,
    lowerBounds: lowerBounds,
    saturationRange: [sMin, sMax],
    brightnessRange: [bMin, bMax]
  };

}

function loadColorBounds () {

  defineColor(
    'monochrome',
    null,
    [[0,0],[100,0]]
  );

  defineColor(
    'red',
    [-26,18],
    [[20,100],[30,92],[40,89],[50,85],[60,78],[70,70],[80,60],[90,55],[100,50]]
  );

  defineColor(
    'orange',
    [18,46],
    [[20,100],[30,93],[40,88],[50,86],[60,85],[70,70],[100,70]]
  );

  defineColor(
    'yellow',
    [46,62],
    [[25,100],[40,94],[50,89],[60,86],[70,84],[80,82],[90,80],[100,75]]
  );

  defineColor(
    'green',
    [62,178],
    [[30,100],[40,90],[50,85],[60,81],[70,74],[80,64],[90,50],[100,40]]
  );

  defineColor(
    'blue',
    [178, 257],
    [[20,100],[30,86],[40,80],[50,74],[60,60],[70,52],[80,44],[90,39],[100,35]]
  );

  defineColor(
    'purple',
    [257, 282],
    [[20,100],[30,87],[40,79],[50,70],[60,65],[70,59],[80,52],[90,45],[100,42]]
  );

  defineColor(
    'pink',
    [282, 334],
    [[20,100],[30,90],[40,86],[60,84],[80,80],[90,75],[100,73]]
  );

}

function HSVtoRGB (hsv) {

  // this doesn't work for the values of 0 and 360
  // here's the hacky fix
  var h = hsv[0];
  if (h === 0) {h = 1;}
  if (h === 360) {h = 359;}

  // Rebase the h,s,v values
  h = h/360;
  var s = hsv[1]/100,
      v = hsv[2]/100;

  var h_i = Math.floor(h*6),
    f = h * 6 - h_i,
    p = v * (1 - s),
    q = v * (1 - f*s),
    t = v * (1 - (1 - f)*s),
    r = 256,
    g = 256,
    b = 256;

  switch(h_i) {
    case 0: r = v; g = t; b = p;  break;
    case 1: r = q; g = v; b = p;  break;
    case 2: r = p; g = v; b = t;  break;
    case 3: r = p; g = q; b = v;  break;
    case 4: r = t; g = p; b = v;  break;
    case 5: r = v; g = p; b = q;  break;
  }

  var result = [Math.floor(r*255), Math.floor(g*255), Math.floor(b*255)];
  return result;
}

function HexToHSB (hex) {
  hex = hex.replace(/^#/, '');
  hex = hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex;

  var red = parseInt(hex.substr(0, 2), 16) / 255,
        green = parseInt(hex.substr(2, 2), 16) / 255,
        blue = parseInt(hex.substr(4, 2), 16) / 255;

  var cMax = Math.max(red, green, blue),
        delta = cMax - Math.min(red, green, blue),
        saturation = cMax ? (delta / cMax) : 0;

  switch (cMax) {
    case red: return [ 60 * (((green - blue) / delta) % 6) || 0, saturation, cMax ];
    case green: return [ 60 * (((blue - red) / delta) + 2) || 0, saturation, cMax ];
    case blue: return [ 60 * (((red - green) / delta) + 4) || 0, saturation, cMax ];
  }
}

function HSVtoHSL (hsv) {
  var h = hsv[0],
    s = hsv[1]/100,
    v = hsv[2]/100,
    k = (2-s)*v;

  return [
    h,
    Math.round(s*v / (k<1 ? k : 2-k) * 10000) / 100,
    k/2 * 100
  ];
}

function stringToInteger (string) {
  var total = 0
  for (var i = 0; i !== string.length; i++) {
    if (total >= Number.MAX_SAFE_INTEGER) break;
    total += string.charCodeAt(i)
  }
  return total
}

// get The range of given hue when options.count!=0
function getRealHueRange(colorHue) {
  if (!isNaN(colorHue)) {
    var number = parseInt(colorHue);

    if (number < 360 && number > 0) {
      return getColorInfo(colorHue).hueRange
    }
  } else if (typeof colorHue === 'string') {

    if (colorDictionary[colorHue]) {
      var color = colorDictionary[colorHue];

      if (color.hueRange) {
        return color.hueRange
      }
    } else if (colorHue.match(/^#?([0-9A-F]{3}|[0-9A-F]{6})$/i)) {
      var hue = HexToHSB(colorHue)[0]
      return getColorInfo(hue).hueRange
    }
  }
}
const ARG_FLAG_SHORTHANDS = {
  'sbc': 'skip-book-close',
  'hz': 'hide-zero',
  'lt': 'light-theme',
  'cml': 'cumulative',
  'cml-cols': 'cumulative-columns',
  'dep': 'max-depth',
  'depth': 'max-depth',
};

const ARG_MODIFIER_SHORTHANDS = {
  'desc': 'description',
  'f': 'from',
  't': 'to',
  'bc': 'bookClose'
};

function argsparser(_args) {
  let args = { _:[], flags: {}, modifiers: {} };

  let uuids = [];

  let bypass = false;
  for (let i = 0;i < _args.length;i++) {
    let arg = _args[i];

    if (arg == '--') { bypass = true; continue; }
    if (bypass) { args._.push(arg); continue; }

    let match = Object.keys(CMD_LIST).filter(x => x.indexOf(arg) == 0).sort();
    if (!match.length && (match = arg.match(/^[a-z0-9]{8}$/i))) {
      uuids.push(arg);
    } else if (match = arg.match(/^-([a-zA-Z])(.+)$/)) {
      args.flags[match[1]] = match[2];
    } else if (match = arg.match(/^--?([^=]+)(=(.*))?$/)) {
      let key = match[1];
      key = ARG_FLAG_SHORTHANDS[key] || key;
      if (!isNaN(Number(key))) { // key cannot be number
        args._.push(arg);
        continue;
      }
      let val = match[3] || (arg.indexOf('=') > 0 ? '' : true);
      if (!isNaN(Number(val))) val = Number(val);
      if (val == 'true') val = true;
      if (val == 'false') val = false;
      args.flags[key] = val;
    } else if (match = arg.match(/^([a-zA-Z_-]+):(.*)$/)) {
      let key = match[1];
      key = ARG_MODIFIER_SHORTHANDS[key] || key;
      let val = match[2];
      if (!isNaN(Number(val))) val = Number(val);
      if (val == 'true') val = true;
      if (val == 'false') val = false;
      args.modifiers[key] = val;
    } else {
      args._.push(arg)
    }
  }
  if (uuids.length) args.modifiers['uuid'] = args.modifiers.uuid || uuids.join("|");
  args._ = args._.filter(x => x.length);
  return args;
}

// '<(' is process substitution operator and
// can be parsed the same as control operator
const ARG_CONTROL = '(?:' + [
    '\\|\\|', '\\&\\&', ';;', '\\|\\&', '\\<\\(', '>>', '>\\&' ].join('|') + ')';
const ARG_META = '';
const ARG_BAREWORD = '(\\\\[\'"' + ARG_META + ']|[^\\s\'"' + ARG_META + '])+';
const ARG_SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
const ARG_DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';

var ARG_TOKEN = '';
for (var i = 0; i < 4; i++) {
    ARG_TOKEN += (Math.pow(16,8)*Math.random()).toString(16);
}

function parseArgSegmentsFromStr(s, env, opts) {
    var mapped = _parseArgSegmentsFromStr(s, env || process.env, opts);
    if (typeof env !== 'function') return mapped;
    return mapped.reduce(function (acc, s) {
        if (typeof s === 'object') return acc.concat(s);
        var xs = s.split(RegExp('(' + ARG_TOKEN + '.*?' + ARG_TOKEN + ')', 'g'));
        if (xs.length === 1) return acc.concat(xs[0]);
        return acc.concat(xs.filter(Boolean).map(function (x) {
            if (RegExp('^' + ARG_TOKEN).test(x)) {
                return JSON.parse(x.split(ARG_TOKEN)[1]);
            }
            else return x;
        }));
    }, []).filter(x => typeof x == 'string');
};

function _parseArgSegmentsFromStr (s, env, opts) {
    var chunker = new RegExp([
        '(' + ARG_CONTROL + ')', // control chars
        '(' + ARG_BAREWORD + '|' + ARG_SINGLE_QUOTE + '|' + ARG_DOUBLE_QUOTE + ')*'
    ].join('|'), 'g');
    var match = s.match(chunker).filter(Boolean);
    var commented = false;

    if (!match) return [];
    if (!env) env = {};
    if (!opts) opts = {};
    return match.map(function (s, j) {
        if (commented) {
            return;
        }
        if (RegExp('^' + ARG_CONTROL + '$').test(s)) {
            return { op: s };
        }

        // Hand-written scanner/parser for Bash quoting rules:
        //
        //  1. inside single quotes, all characters are printed literally.
        //  2. inside double quotes, all characters are printed literally
        //     except variables prefixed by '$' and backslashes followed by
        //     either a double quote or another backslash.
        //  3. outside of any quotes, backslashes are treated as escape
        //     characters and not printed (unless they are themselves escaped)
        //  4. quote context can switch mid-token if there is no whitespace
        //     between the two quote contexts (e.g. all'one'"token" parses as
        //     "allonetoken")
        var SQ = "'";
        var DQ = '"';
        var DS = '$';
        var BS = opts.escape || '\\';
        var quote = false;
        var esc = false;
        var out = '';
        var isGlob = false;

        for (var i = 0, len = s.length; i < len; i++) {
            var c = s.charAt(i);
//             isGlob = isGlob || (!quote && (c === '*' || c === '?'));
            if (esc) {
                out += c;
                esc = false;
            }
            else if (quote) {
                if (c === quote) {
                    quote = false;
                }
                else if (quote == SQ) {
                    out += c;
                }
                else { // Double quote
                    if (c === BS) {
                        i += 1;
                        c = s.charAt(i);
                        if (c === DQ || c === BS || c === DS) {
                            out += c;
                        } else {
                            out += BS + c;
                        }
                    }
                    else if (c === DS) {
                        out += parseEnvVar();
                    }
                    else {
                        out += c;
                    }
                }
            }
            else if (c === DQ || c === SQ) {
                quote = c;
            }
//             else if (RegExp('^' + ARG_CONTROL + '$').test(c)) {
//                 return { op: s };
//             }
//             else if (RegExp('^#$').test(c)) {
//                 commented = true;
//                 if (out.length){
//                     return [out, { comment: s.slice(i+1) + match.slice(j+1).join(' ') }];
//                 }
//                 return [{ comment: s.slice(i+1) + match.slice(j+1).join(' ') }];
//             }
            else if (c === BS) {
                esc = true;
            }
            else if (c === DS) {
                out += parseEnvVar();
            }
            else out += c;
        }

        if (isGlob) return {op: 'glob', pattern: out};

        return out;

        function parseEnvVar() {
            i += 1;
            var varend, varname;
            //debugger
            if (s.charAt(i) === '{') {
                i += 1;
                if (s.charAt(i) === '}') {
                    throw new Error("Bad substitution: " + s.substr(i - 2, 3));
                }
                varend = s.indexOf('}', i);
                if (varend < 0) {
                    throw new Error("Bad substitution: " + s.substr(i));
                }
                varname = s.substr(i, varend - i);
                i = varend;
            }
            else if (/[*@#?$!_\-]/.test(s.charAt(i))) {
                varname = s.charAt(i);
                i += 1;
            }
            else {
                varend = s.substr(i).match(/[^\w\d_]/);
                if (!varend) {
                    varname = s.substr(i);
                    i = s.length;
                } else {
                    varname = s.substr(i, varend.index);
                    i += varend.index - 1;
                }
            }
            return getVar(null, '', varname);
        }
    })
    // finalize parsed aruments
    .reduce(function(prev, arg){
        if (arg === undefined){
            return prev;
        }
        return prev.concat(arg);
    },[]);

    function getVar (_, pre, key) {
        var r = typeof env === 'function' ? env(key) : env[key];
        if (r === undefined && key != '')
            r = '';
        else if (r === undefined)
            r = '$';

        if (typeof r === 'object') {
            return pre + ARG_TOKEN + JSON.stringify(r) + ARG_TOKEN;
        }
        else return pre + r;
    }
}
class Chart {
  constructor(min, max, data) {
    let dataSets = data[0].length;
    this.data = data;
    this.width = process.stdout.columns;
    this.height = process.stdout.rows - 10;
    this.gw = this.width - 7;
    this.gh = this.height - 3 - 2;
    this.min = min;
    this.max = max;

    let cl = this.colors = [c.bgGreen, c.bgRedBright, c.bgBlue, c.bgYellowBright, c.bgWhiteBright, c.Cyan];

    let range = this.range = Math.abs(max - min);
    let div = this.div = Math.max(this.range / this.gh, 0.01);
    let zeroRow = this.zeroRow = Math.round(max / div);

    let buffer = this.buffer = [];
    for (let i = 0;i <= this.gh + 1;i++) {
      buffer[i] = [];
      if (i == 0 || i == this.gh || i == zeroRow) this.drawYLabel(i);
      for (let j = 0;j < this.width;j++) {
        if (j == 6)
          buffer[i][j] = tree_c3;
        else
          buffer[i][j] = buffer[i][j] || ' ';
      }
    }

    let plcs = accounting_numDigits(max);
    let n = Math.pow(10, plcs - 1) / 4;
    for (let i = n;i < max;i += n) {
      let row = Math.round((max - i) / div);
      this.drawYLabel(row, i);
    }
    for (let i = -n;i > min;i -= n) {
      let row = zeroRow - Math.round((i) / div) + 1;
      this.drawYLabel(row, i);
    }
    for (let i = data.length - 1;i >= 0;i--) {
      let set = data[i];
      let col = (i * (dataSets * 2 + 1)) + 7;
      for (let j = 0;j < set.length;j++) {
        let val = set[j];
        let mxrow = 1;
        let mnrow = 0;
        if (val > 0) {
          mxrow = Math.round((max - val) / div) + 1;
          mnrow = zeroRow;
        } else if (val < 0) {
          mxrow = zeroRow + 1;
          mnrow = zeroRow - Math.round((val) / div);
        }
        for (let r = mxrow;r <= mnrow;r++) {
          buffer[r][col + j * 2] = cl[j](buffer[r][col + j * 2] );
          buffer[r][col + j * 2 + 1] = cl[j](buffer[r][col + j * 2 + 1]);
        }
      }
    }
  }

  formatNum(num) {
    const si = [
      { value: 1, symbol: "" },
      { value: 1E3, symbol: "k" },
      { value: 1E6, symbol: "M" },
      { value: 1E9, symbol: "G" },
      { value: 1E12, symbol: "T" },
      { value: 1E15, symbol: "P" },
      { value: 1E18, symbol: "E" }
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    let i;
    for (i = si.length - 1; i > 0; i--) if (num >= si[i].value) break;
    return (num / si[i].value).toFixed(2).replace(rx, "$1") + si[i].symbol;
  }

  drawYLabel(row, num) {
    num = num || (this.max - this.div * row);
    let isN = num < 0;
    if (isN) num = -num;
    let str = this.formatNum(num);
    if (isN) str = '-' + str;
    this.replace(row, 0, str.padStart(6));
  }

  replace(row, col, str, sf) {
    for (let i = 0;i < str.length;i++) {
      if (sf)
        this.buffer[row][col + i] = this.buffer[row][col + i].replace(' ', str[i]);
      else
        this.buffer[row][col + i] = str[i];
    }
  }

  render() {
    return '\n' + this.buffer
      .map((r, i) => i == this.zeroRow ? c.underline(r.join("")) : r.join("")).join("\n")
  }
}
var CMD_LIST = {
  'version': cmd_version,
  'help': cmd_help,
  'benchmark': cmd_benchmark,

  'add': cmd_add,
  'modify': cmd_modify,
  'delete': cmd_delete,
  'edit': cmd_edit,

  'info': cmd_info,
  'register': cmd_register,
  'accounts': cmd_accounts,
  'budget': cmd_budget,
  'history': cmd_history,
  'print': cmd_print,
  'burndown': cmd_burndown,

  'tags': cmd_tags,
  'stats': cmd_stats,
  'count': cmd_count,

  'export': cmd_export,

  'git': cmd_git
};
const DEFAULT_COMMAND = 'version';

var cli_args = { _: [], modifiers: {}, flags: {} };

var DEBUG = false;

async function index() {
  let _start = new Date();
  fs_book_name = process.env["LEDG_BOOK"] || fs_book_name;
  let argv = process.argv.slice(2);
  if (fs.existsSync(`${process.env.HOME}/.ledgrc`)) {
    let content = fs.readFileSync(`${process.env.HOME}/.ledgrc`).toString();
    content.replace(/\r/g, '').split("\n").forEach(x => {
      argv = parseArgSegmentsFromStr(x).concat(argv);
    });
  }

  cli_args = args = argsparser(argv);
  if (args.flags.debug) DEBUG = true;
  fs_book_name = (args.flags.F || args.flags.file || fs_book_name).replace(/~/g, process.env.HOME || '~');

  // stdin pipe
  if (fs_book_name == '-') {
    stdin_rl.resume();
    let entry = null;
    const commitEntry = (entry) => {
      let year = new Date(entry.time * 1000).getFullYear();
      data.books[year] = data.books[year] || [];
      data.books[year].push(entry);
      data.booksOpened[year] = DATA_BOOK_OPENED;
      _fs_entries_read++;
    };

    for await (let line of stdin_rl) {
      entry = fs_read_book_proc_line(entry, line, commitEntry);
    }
    if (entry) { commitEntry(entry) }
    stdin_rl.pause();
    await fs_get_data_range();
  } else {
    await fs_get_data_range();
    await fs_attempt_load_budgets();
    if (fs.existsSync(fs_book_name + '.config.ledg'))
      await fs_attempt_load_config();
    else if (fs_data_range.length) {
      console.error("Missing config file, reconstructing from existing books");
      await fs_construct_config();
    }
  }

  let _endConfig = new Date();

  report_set_modifiers(args);
  let cmd = CMD_LIST[(args.flags.help || args.flags.H || args.flags.h) ? 'help' : 'accounts'];

  if (args._[0]) {
    let matches = Object.keys(CMD_LIST).filter(x => x.indexOf(args._[0]) == 0).sort();
    if (matches.length == 0) {
      args._.unshift(cmd);
    } else if (matches.length == 1) cmd = CMD_LIST[matches[0]];
    else {
      console.error(`Ambiguous action command ${c.bold(args._[0])}, multiple matches availabe: ${matches.map(x => c.bold(x)).join(", ")}`);
      process.exit(1);
    }
  }

  if (cmd) {
    args._.splice(0,1);
    let _endCmd = new Date();
    let c = await cmd(args);
    if (DEBUG) {
      console.debug(`_endConfig=${_endConfig - _start}ms, _endCmd=${new Date() - _endCmd}ms`);
    }
    if (c) { process.exit(c) }
    else if (fs_book_name != '-') { await fs_write_books(); }
  }
}

var readline_last_value;

async function readline_prompt() {
  stdin_rl.resume();
  const line1 = (await stdin_it.next()).value;
  readline_last_value = line1;
  stdin_rl.pause();
  return line1.trim();
}

var stdin_rl;
var stdin_it;
var ESC = '';

if (require.main === module && typeof TEST == "undefined") {
  stdin_rl = readline.createInterface({
    input: process.stdin, //or fileStream
    //output: process.stdout
  });
  stdin_it = stdin_rl[Symbol.asyncIterator]();
  stdin_rl.pause();
  stdin_rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
  process.on("SIGINT", function () {
    process.exit(1);
  });
  index();
}
