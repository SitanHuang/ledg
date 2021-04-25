class AccountTreeView {
  constructor(topLevel, periods) {
    this.topLevel = !!topLevel;

    this.historicalSum = new Money();

    this.sums = AccountTreeView.fillSums(periods);
    this.periods = periods;

    this.name = "";
    this._fullName = "";

    this.depth = 0;

    this.children = {};
  }

  sumForDepth(depth=Infinity, doNotAdd) {
    this.dsum = this.sums; //.map(x => x.plus(hsum));

    let keys = Object.keys(this.children);
    for (let n of keys) {
      let child = this.children[n];
      child.sumForDepth(depth, doNotAdd);

      if (this.depth < depth)
        continue;

      // if this.depth == depth, fold children

      if (!doNotAdd) {
        this.dsum = this.dsum.map((x, i) => x.plus(child.dsum[i]));
        this.historicalSum = this.historicalSum.plus(child.historicalSum);
      }
      delete this.children[n];
    }

    this.calcTotalSum();
  }

  isZeroRecursive() {
    for (let sum of this.dsum)
      if (!sum.isZero())
        return false;
    for (let c in this.children)
      if (!this.children[c].isZeroRecursive())
        return false;

    return true;
  }

  recursiveRemoveEmpty() {
    let children = Object.keys(this.children);
    FOR:
    for (let c of children) {
      if (this.children[c].isZeroRecursive()) {
        delete this.children[c];
        continue;
      }
      this.children[c].recursiveRemoveEmpty();
    }
  }

  recursiveCumulate() {
    this.sums[0] = this.sums[0].plus(this.historicalSum);
    for (let i = 1;i < this.sums.length;i++)
      this.sums[i] = this.sums[i].plus(this.sums[i - 1]);

    for (let c in this.children)
      this.children[c].recursiveCumulate();
  }

  /*
   * handled by query.js
   sumParent() {
    for (let c in this.children) {
      let child = this.children[c];
      child.sumParent();

      this.dsum = this.dsum.map((x, i) => x.plus(child.dsum[i]));
    }
    this.calcTotalSum();
  }*/

  calcTotalSum() {
    let total = new Money();
    this.dsum.forEach(x => total = x.plus(total));
    this.totalSum = total;
  }

  /*
   * accsumsArr = Periods [ Sums { acc: sum, ... }, ... ]
   */
  putAccSumsArr(accsumsArr) {
    for (let i = 0;i < accsumsArr.length;i++)
      for (let acc in accsumsArr[i]) {
        this.putAcc(acc);
        this.getAcc(acc).putAmntAtPeriod(accsumsArr[i][acc], i);
      }
  }

  putHistoricalSums(accSums) {
    for (let acc in accSums) {
      this.putAcc(acc);
      this.getAcc(acc).historicalSum = accSums[acc];
    }
  }

  putAmntAtPeriod(amnt, i) {
    this.sums[i] = this.sums[i].plus(amnt);
  }

  getAcc(acc) {
    if (acc == this._fullName)
      return this;
    let levels = acc.split('.');

    let prev = this;
    for (let i = 0;i < levels.length;i++) {
      let sub = levels[i];
      prev = prev.children[sub];
    }
    return prev;
  }

  putAcc(acc) {
    if (!this.topLevel)
      throw 'FATAL: tree.js putAcc called not from top level';
    let levels = acc.split('.');

    let prevN = '';
    let prev = this;
    for (let i = 0;i < levels.length;i++) {
      let sub = levels[i];
      prevN += i == 0 ? sub : '.' + sub;

      prev = prev.createChild(prevN, sub);
    }
  }

  createChild(fullname, sub) {
    if (this.children[sub])
      return this.children[sub];

    let c = new AccountTreeView(false, this.periods);
    c.fullName = fullname;

    this.children[sub] = c;
    return c;
  }

  set fullName(name) {
    this._fullName = name;
    let levels = name.split('.');
    this.name = levels.pop();
    this.depth = levels.length + 1;
  }

  get fullName() {
    return this._fullName;
  }

  static fillSums(p) {
    return Array(p).fill(0).map(() => new Money());
  }
}
