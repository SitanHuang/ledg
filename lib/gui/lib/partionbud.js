let thePartitionView;

class PartitionBudgetView extends TabView {
  constructor(t, d) {
    super(t);
    this.title = `Budget Partition View`;

    this._maxDepth = 3;

    if (thePartitionView) {
      thePartitionView.updateContent(d);
      super.onClose();
      setTimeout(() => {
        doctabs.selectTab(thePartitionView.tab);
      }, 100);
      return;
    }
    thePartitionView = this;
    this.updateContent(d);
  }

  onClose() {
    super.onClose();
    thePartitionView = null;
    mpart_disks = [];
  }

  async updateContent(d) {
    await super.updateContent();
    if (!d) return;
    let forkedBudgets = {};
    let disks = {};
    let budget = data.budgets[this._bud = d.budget];
    let baccs = Object.keys(budget.budgets).sort();
    // sum parent for budget
    baccs.forEach(x => {
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
    for (let k in forkedBudgets) { forkedBudgets[k] = forkedBudgets[k].toNumber(); }
    baccs.forEach(x => {
      let levels = x.split(".");
      let previous = "";
      for (let l of levels) {
        let k = previous + l;
        if (k.indexOf('.') < 0) {
          disks[k] = disks[k] || mpart_dsk_create(forkedBudgets[k]);
          disks[k].label = d.budget + ' - ' + k;
        } else
          disks[k] = disks[k] || mpart_partition_create(disks[previous.replace(/\.$/, '')], { fixed: forkedBudgets[k], label: l });
        previous = k + ".";
      }
    });
    disks = document.createElement('disks');
    let html = '';
    let i = 0;
    for (let disk of mpart_disks) {
      html += reload_disk_panel(disk, i++);
    }
    disks.innerHTML = html;
    this.view.appendChild(disks);
  }
}