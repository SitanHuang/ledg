class AccountTreeView {
  constructor(topLevel, periods) {
    this.topLevel = !!topLevel;

    this.historicalSum = new Money();

    this.sums = AccountTreeView.fillSums(periods);
    this.periods = periods;

    this._name = "";
    this._fullName = "";

    this.depth = 0;
  }

  set fullName(name) {
    this._fullName = name;
    this.name = name.split('.').pop;
  }

  get fullName() {
    return this._fullName;
  }

  get name() {
    return this.name;
  }

  static fillSums(p) {
    return Array(p).fill(0).map(() => new Money());
  }
}
