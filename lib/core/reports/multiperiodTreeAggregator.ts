import { Account, AccountIdentifier } from "../accounting/account.ts";
import { Amount } from "../accounting/amount.ts";
import { Journal } from "../data/journal.ts";
import { Rational } from "../math/rational.ts";
// import { SourceableError } from "../errors.ts";
import { isNone, Result, timestamp } from "../types.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { QueryEngineExecutor } from "./query/queryEngineExecutor.ts";
import { Period, ReportPolicy } from "./reportPolicy.ts";

export class MultiperiodTreeAggregator {
  private rootTreeItem: MultiperiodTreeItem;
  private periods: readonly Period[];

  constructor(
    public readonly journal: Journal,
    protected readonly queryEngineExecutor: QueryEngineExecutor,
    protected readonly reportPolicy: ReportPolicy,
  ) {
    this.rootTreeItem = this.createRootTreeItem();
    this.periods = this.createPeriods();
  }

  execute(): this {
    this.rootTreeItem = this.createRootTreeItem();
    this.periods = this.createPeriods();

    this.populateAllAccounts();
    this.executeQuery();

    if (this.reportPolicy.tree) {
      this.rootTreeItem.treeView();
    } else {
      this.rootTreeItem.applyFlatPolicy();
    }

    this.rootTreeItem.accumulateAndValuate();

    if (this.reportPolicy.hideZero) {
      this.rootTreeItem.pruneZeros();
    }

    if (this.reportPolicy.inversion) {
      this.rootTreeItem.invert();
    }

    return this;
  }

  private createRootTreeItem() {
    return new MultiperiodTreeItem(this, "", this.reportPolicy, 0);
  }
  private createPeriods() {
    return this.reportPolicy.periods();
  }

  private executeQuery(): Result<MultiperiodTreeItem> {
    const { rootTreeItem, displayedAccounts } = this;
    const { currencyConversionService } = this.journal;
    const { valuationStrategy, valuationCurrency } = this.reportPolicy;
    const useLedgObjDate = this.reportPolicy.useLedgObjDate.bind(this.reportPolicy);

    const valuationPolicy = new ValuationPolicy(0);

    // let error: Error | null = null;

    this.queryEngineExecutor.executePostings(this.journal, (posting) => {
      let amount = posting.amount;

      const date = useLedgObjDate(posting);

      // We don't wanna create empty entries in rootTreeItem.accept that cause
      // unopened/closed accounts to pop up
      if (!displayedAccounts.has(posting.account.identifier)) {
        return;
      }

      if (valuationCurrency && valuationStrategy == "txnDate") {
        // TRANSACTION PRIMARY DATE BY SPEC
        valuationPolicy.valuationDate = posting.transaction.date;

        const result = amount.convertToAmount(valuationCurrency, currencyConversionService, valuationPolicy);

        if (isNone(result)) {
          // error = new SourceableError(`Failed to convert amount "${amount.toFractionString()}" to currency ${valuationCurrency.id} at transaction primary date.`, posting.transaction.source.sourceText ?? '[Unknown source]');
          // return "stop";

          // ignore
        } else {
          amount = result;
        }
      }

      rootTreeItem.accept(posting.account.identifier, date, amount);
    });

    // if (error) {
    //   return error;
    // }

    return rootTreeItem;
  }

  private displayedAccounts = new Set<AccountIdentifier>();

  private populateAllAccounts() {
    const { accountManager } = this.journal;
    const { reportPolicy, displayedAccounts } = this;

    let accounts = this.queryEngineExecutor.queryAccounts(this.journal);

    if (reportPolicy.reportFrom !== undefined && reportPolicy.reportTo !== undefined) {
      const openedAccounts = accountManager.getAccountsEverOpenedDuringRange(reportPolicy.reportFrom, reportPolicy.reportTo);

      accounts = accounts.filter(account => openedAccounts.includes(account));
    }

    displayedAccounts.clear();

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      displayedAccounts.add(account.identifier);

      this.rootTreeItem.accept(account.identifier, reportPolicy.reportFrom ?? reportPolicy.reportTo ?? reportPolicy.from ?? reportPolicy.to ?? 0);
    }

    // const accounts = this.queryEngineExecutor.queryAccounts(this.journal);

    // for (let i = 0; i < accounts.length; i++) {
    //   const account = accounts[i];

    //   if (reportPolicy.reportFrom !== undefined && reportPolicy.reportTo !== undefined) {
    //     const status1 = accountManager.getAccountStatusByDateRange(account.identifier, reportPolicy.reportFrom);
    //     const status2 = accountManager.getAccountStatusByDateRange(account.identifier, Math.max(reportPolicy.reportTo - 1, reportPolicy.reportFrom));

    //     if (status1 !== "open" && status2 !== "open") {
    //       // Account is closed throughout entire duration.
    //       continue;
    //     }
    //   }

    //   this.rootTreeItem.accept(account.identifier, reportPolicy.reportFrom ?? reportPolicy.reportTo ?? reportPolicy.from ?? reportPolicy.to ?? 0);
    // }
  }

  debugCSV(displayPrecision = Infinity): string {
    return this.rootTreeItem.debugCSV(this.reportPolicy, displayPrecision);
  }
}

export class MultiperiodTreeItem {
  private baselineAmount: Amount = Amount.ZERO;
  private readonly additiveSums: Amount[];
  private readonly periods: readonly Period[];

  // flat children map; content may be rebuilt by treeView()/applyFlatPolicy()
  private children = new Map<string, MultiperiodTreeItem>();

  constructor(
    protected readonly aggregator: MultiperiodTreeAggregator,
    protected readonly accountIdentifier: AccountIdentifier,
    protected readonly reportPolicy: ReportPolicy,
    protected readonly depth = 0, // 0 = root level
  ) {
    this.periods = this.reportPolicy.periods();
    this.additiveSums = Array(this.periods.length).fill(Amount.ZERO);
  }

  accept(accountId: AccountIdentifier, ts: timestamp, amount?: Amount) {
    const policy = this.reportPolicy;

    if (accountId == this.accountIdentifier) {
      if (!amount) {
        return;
      }

      const bucketIdx = policy.bucketIndex(ts);

      if (bucketIdx >= 0) {
        this.additiveSums[bucketIdx] = this.additiveSums[bucketIdx].plus(amount);
      }

      if (policy.cumulative && policy.reportFrom && ts < policy.reportFrom) {
        this.baselineAmount = this.baselineAmount.plus(amount);
      }
    } else {
      const child = this.children.get(accountId) ?? new MultiperiodTreeItem(this.aggregator, accountId, policy, this.depth + 1);
      this.children.set(accountId, child);
      child.accept(accountId, ts, amount);
    }

    return;
  }

  /**
   * Reorganises the flat `children` map into a true account hierarchy,
   * enforces `maxDepth` / `minDepth`, and ensures parent totals are correct.
   * Must be called **once** from the root after all postings are ingested.
   */
  treeView(): void {
    // 1. build hierarchical skeleton from the existing leaves
    const leaves = Array.from(this.children.values());
    this.children.clear(); // rebuild from scratch

    for (const leaf of leaves) {
      const groups = Account.splitIdentifier(leaf.accountIdentifier);
      const parents: MultiperiodTreeItem[] = [];
      let node: MultiperiodTreeItem = this; // start at ROOT
      let path = "";

      for (let i = 0; i < groups.length; i++) {
        path = path ? `${path}${Account.DELIMITER}${groups[i]}` : groups[i];
        node = node._getOrCreateChild(path, node.depth + 1);
        parents.push(node);
      }

      // copy money figures into the new leaf (last parent)
      const dst = parents[parents.length - 1];
      dst._copyTotalsFrom(leaf);

      // always roll totals up the chain for a tree view
      for (let i = parents.length - 2; i >= 0; i--) {
        parents[i]._copyTotalsFrom(parents[i + 1]);
      }
    }

    // 2. honour MAX‑DEPTH (remove deeper nodes, keep sums)
    if (Number.isFinite(this.reportPolicy.maxDepth)) {
      this._pruneToMaxDepth(this.reportPolicy.maxDepth);
    }

    // 3. honour MIN‑DEPTH (flatten shallow prefixes)
    if (this.reportPolicy.minDepth > 0) {
      this._applyMinDepth(this.reportPolicy.minDepth);
    }
  }

  /**
   * Flat‑mode post‑processing:
   *   - trims accounts deeper than `maxDepth`
   *   - optionally injects parent rows (sumParent) down to `minDepth`
   * Called only when `reportPolicy.tree === false`.
   */
  applyFlatPolicy(): void {
    if (this.reportPolicy.maxDepth !== Infinity) {
      const toTrim: [string, MultiperiodTreeItem][] = [];
      for (const [id, item] of this.children) {
        const depth = Account.splitIdentifier(id).length;
        if (depth > this.reportPolicy.maxDepth) {
          toTrim.push([id, item]);
        }
      }
      for (const [id, item] of toTrim) {
        this.children.delete(id);
        const parentId = Account.joinDelimitedGroups(
          Account.splitIdentifier(id)
            .slice(0, this.reportPolicy.maxDepth)
        );
        const anc = this._getOrCreateChild(parentId, 1);
        anc._copyTotalsFrom(item);
      }
    }

    if (this.reportPolicy.sumParent) {
      const current = Array.from(this.children.values());
      for (const item of current) {
        const segs = Account.splitIdentifier(item.accountIdentifier);
        for (let lvl = segs.length - 1; lvl >= Math.max(this.reportPolicy.minDepth, 1); lvl--) {
          const parentId = Account.joinDelimitedGroups(segs.slice(0, lvl));
          const parent = this._getOrCreateChild(parentId, 1);
          parent._copyTotalsFrom(item);
        }
      }
    }
  }

  /**
   * Cumulative per‑period roll‑up.
   */
  accumulateAndValuate(): void {
    this.accumulate();
    this.valuate();
  }

  private accumulate(): void {
    if (!this.reportPolicy.cumulative) {
      return;
    }

    for (let i = 0; i < this.additiveSums.length; i++) {
      const prev = i - 1;
      this.additiveSums[i] = this.additiveSums[i].plus(prev < 0 ? this.baselineAmount : this.additiveSums[prev]);
    }

    for (const child of this.children.values()) {
      child.accumulate();
    }
  }

  private valuate(): void {
    const { currencyConversionService } = this.aggregator.journal;
    const { valuationStrategy, valuationCurrency } = this.reportPolicy;

    if (!valuationCurrency) {
      return;
    }

    for (let i = 0; i < this.additiveSums.length; i++) {
      const period = this.periods[i];

      const valuationDate = typeof valuationStrategy === 'number' ? valuationStrategy : Math.max(period.to - 1, period.from);
      const result = this.additiveSums[i].convertToAmount(valuationCurrency, currencyConversionService, new ValuationPolicy(valuationDate));

      if (isNone(result)) {
        // error = new SourceableError(`Failed to convert amount "${amount.toFractionString()}" to currency ${valuationCurrency.id} at transaction primary date.`, posting.transaction.source.sourceText ?? '[Unknown source]');
        // return "stop";

        // ignore
        continue;
      }

      this.additiveSums[i] = result;
    }

    for (const child of this.children.values()) {
      child.valuate();
    }
  }

  /** copy baseline & all additive sums */
  private _copyTotalsFrom(src: MultiperiodTreeItem): void {
    this.baselineAmount = this.baselineAmount.plus(src.baselineAmount);
    for (let i = 0; i < this.additiveSums.length; i++) {
      this.additiveSums[i] = this.additiveSums[i].plus(src.additiveSums[i]);
    }
  }

  /** get‑or‑create helper (keeps O(1) lookup) */
  private _getOrCreateChild(id: AccountIdentifier, depth: number): MultiperiodTreeItem {
    const c = this.children.get(id);
    if (!c) {
      const d = new MultiperiodTreeItem(this.aggregator, id, this.reportPolicy, depth);
      this.children.set(id, d);
      return d;
    }
    return c;
  }

  /** drops / aggregates sub‑trees deeper than `maxDepth` */
  private _pruneToMaxDepth(maxDepth: number): void {
    if (this.depth >= maxDepth) {
      // aggregate everything below then delete references
      for (const child of this.children.values()) {
        this._copyTotalsFrom(child);
      }
      this.children.clear();
      return;
    }
    for (const child of this.children.values()) child._pruneToMaxDepth(maxDepth);
  }

  /** promotes nodes so that root‑visible depth == `minDepth` */
  private _applyMinDepth(minDepth: number): void {
    if (this.depth >= minDepth - 1) return;  // nothing to flatten here

    // collect grandchildren we will promote
    const promoted: MultiperiodTreeItem[] = [];
    for (const child of this.children.values()) {
      child._applyMinDepth(minDepth);
      if (child.depth === minDepth - 1) {
        for (const gc of child.children.values()) promoted.push(gc);
      }
    }

    if (promoted.length) {
      this.children.clear();
      for (const p of promoted) this.children.set(p.accountIdentifier, p);
    }
  }

  /** Total across all periods. */
  grandTotal(): Amount {
    let total = Amount.ZERO;
    for (const a of this.additiveSums) total = total.plus(a);
    return total;
  }

  /**
   * Returns children **in the order requested by ReportPolicy.sortStrategy**.
   * The Map itself is left untouched – ordering is applied only when iterating.
   */
  private _sortedChildren(): MultiperiodTreeItem[] {
    const kids = Array.from(this.children.values());
    const { sortStrategy } = this.reportPolicy;

    if (sortStrategy === "accountId") {
      kids.sort((a, b) => a.accountIdentifier.localeCompare(b.accountIdentifier));
    } else {
      const asc = sortStrategy === "asc";
      kids.sort((a, b) => {
        const cmp = a.grandTotal().naiveCompareTo(b.grandTotal());
        return asc ? cmp : -cmp;
      });
    }
    return kids;
  }

  /* ensure ALL outward‑facing iterations respect the sort order */
  private _forEachChild(fn: (c: MultiperiodTreeItem) => void): void {
    for (const c of this._sortedChildren()) fn(c);
  }

  /**
   * Returns **true** if this node should be kept (has non‑zero data or, in tree
   * view, still has non‑empty descendants).  Called post‑valuation.
   * When it returns *false* the caller must delete this child from its map.
   */
  pruneZeros(): boolean {
    // first let children decide; delete those that return false
    for (const [id, child] of this.children) {
      if (!child.pruneZeros()) this.children.delete(id);
    }

    // determine if *this* node is completely zero
    const selfIsZero = this._allPeriodsZero();

    if (this.reportPolicy.tree) {
      // keep if any child survived OR self has data
      return !selfIsZero || this.children.size > 0 || this.depth === 0;
    } else {
      // flat mode ⇒ keep only when self has data (root survives regardless)
      return !selfIsZero || this.depth === 0;
    }
  }

  invert() {
    this.baselineAmount = this.baselineAmount.times(Rational.NEGATIVE_ONE);
    for (let i = 0; i < this.additiveSums.length; i++) {
      this.additiveSums[i] = this.additiveSums[i].times(Rational.NEGATIVE_ONE);
    }

    for (const child of this.children.values()) {
      child.invert();
    }
  }

  /** true when every period’s total is exactly 0 */
  private _allPeriodsZero(): boolean {
    for (const a of this.additiveSums) {
      if (!a.isStrictlyZero()) {
        return false;
      }
    }
    return true;
  }

  debugCSV(policy: ReportPolicy, displayPrecision: number): string {
    const headers = [
      `"Account"`,
      `"Depth"`,
      ...this.periods.map(p => `"${new Date(p.from).toISOString()} => ${new Date(p.to).toISOString()}"`)
    ];
    const lines: string[] = [headers.join(",")];

    const treeMode = policy.tree;

    const walk = (node: MultiperiodTreeItem) => {
      if (node.accountIdentifier) {
        const depth = treeMode ? node.depth : 1;
        const row = [
          `"${node.accountIdentifier}"`,
          `"${depth}"`,
          ...node.additiveSums.map(a => `"${displayPrecision < Infinity ? a.toString({ displayPrecision }) : a.toFractionString()}"`)
        ];
        lines.push(row.join(","));
      }
      node._forEachChild(walk);
    };

    this._forEachChild(walk);
    return lines.join("\n");
  }
}