class PartitionBudget extends QueryView {
  constructor(t, data) {
    super(t);
    this._bud = data.budget;
    this.title = `"${this._bud}" Partition View`;
  }
}