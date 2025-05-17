import { Account, AccountIdentifier } from "../accounting/account.ts";
import { Amount } from "../accounting/amount.ts";
import { Journal } from "../data/journal.ts";
import { Rational } from "../math/rational.ts";
// import { SourceableError } from "../errors.ts";
import { isNone, isOk, Maybe, Ok, Result, timestamp } from "../types.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { QueryEngineExecutor } from "./query/queryEngineExecutor.ts";
import { Period, ReportPolicy } from "./reportPolicy.ts";

export class MultiperiodTreeAggregator {
  protected rootTreeItem: MultiperiodTreeItem;
  protected periods: readonly Period[];

  constructor(
    public readonly journal: Journal,
    protected readonly queryEngineExecutor: QueryEngineExecutor,
    protected readonly reportPolicy: ReportPolicy,
  ) {
    this.rootTreeItem = this.createRootTreeItem();
    this.periods = this.createPeriods();
  }

  execute(): Result<MultiperiodTreeItem> {
    this.rootTreeItem = this.createRootTreeItem();
    this.periods = this.createPeriods();

    this.populateAllAccounts();
    let result = this.executeQuery();

    if (!isOk(result)) {
      return result;
    }

    if (this.reportPolicy.tree) {
      this.rootTreeItem.treeView();
    } else {
      this.rootTreeItem.applyFlatPolicy();
    }

    result = this.rootTreeItem.accumulateAndValuate();
    if (!isOk(result)) {
      return result;
    }

    if (this.reportPolicy.hideZero) {
      this.rootTreeItem.pruneZeros();
    }

    if (this.reportPolicy.inversion) {
      this.rootTreeItem.invert();
    }

    this.rootTreeItem.rootItemAggregateChildTotals();

    return this.rootTreeItem;
  }

  protected createRootTreeItem() {
    return new MultiperiodTreeItem(this, "", this.reportPolicy, 0);
  }
  protected createPeriods() {
    return this.reportPolicy.periods();
  }

  protected executeQuery(): Maybe {
    const { rootTreeItem, displayedAccounts } = this;
    const { currencyConversionService, currencyProvider } = this.journal;
    const { valuationStrategy, valuationCurrencyId } = this.reportPolicy;
    const useLedgObjDate = this.reportPolicy.useLedgObjDate.bind(this.reportPolicy);

    const valuationPolicy = new ValuationPolicy(0);
    const valuationCurrency = valuationCurrencyId ? currencyProvider.getOrCreateCurrencyById(valuationCurrencyId) : undefined;

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

    return Ok;
  }

  protected displayedAccounts = new Set<AccountIdentifier>();

  protected populateAllAccounts() {
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
  protected baselineAmount: Amount = Amount.ZERO;
  public readonly additiveSums: Amount[];
  public readonly periods: readonly Period[];

  // flat children map; content may be rebuilt by treeView()/applyFlatPolicy()
  protected children = new Map<string, MultiperiodTreeItem>();

  protected readonly delimitedGroups: readonly string[];

  constructor(
    protected readonly aggregator: MultiperiodTreeAggregator,
    public readonly accountIdentifier: AccountIdentifier,
    public readonly reportPolicy: ReportPolicy,
    public depth = 0, // 0 = root level
  ) {
    this.periods = this.reportPolicy.periods();
    this.additiveSums = Array(this.periods.length).fill(Amount.ZERO);

    this.delimitedGroups = Account.splitIdentifier(accountIdentifier);
  }

  public get displayedName() {
    if (!this.reportPolicy.tree) {
      return this.accountIdentifier;
    }

    if (this.depth < this.reportPolicy.minDepth) {
      return this.accountIdentifier;
    }

    return this.delimitedGroups.at(-1) ?? this.accountIdentifier;
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
    const leaves = Array.from(this.children.values())
      // VERY IMPORTANT: if unsorted, we run risk of going bottom-up and double count
      .sort((a, b) => a.delimitedGroups.length - b.delimitedGroups.length);
    this.children.clear(); // rebuild from scratch

    for (const leaf of leaves) {
      const groups = leaf.delimitedGroups;
      const parents: MultiperiodTreeItem[] = [];
      let node: MultiperiodTreeItem = this; // start at ROOT
      let path = "";

      for (let i = 0; i < groups.length; i++) {
        path = path ? `${path}${Account.DELIMITER}${groups[i]}` : groups[i];
        node = node._getOrCreateChild(path, node.depth + 1);
        parents.push(node);
      }

      // clone the leaf’s own numbers into the final node
      const dst = parents[parents.length - 1];
      dst._copyTotalsFrom(leaf);

      // roll totals up the chain for a tree view
      if (this.reportPolicy.sumParent) {
        for (let i = parents.length - 2; i >= 0; i--) {
          parents[i]._copyTotalsFrom(parents[parents.length - 1]);
        }
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

  rootItemAggregateChildTotals(): void {
    for (const child of this.children.values()) {
      this._copyTotalsFrom(child);
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
        const depth = item.delimitedGroups.length;
        if (depth > this.reportPolicy.maxDepth) {
          toTrim.push([id, item]);
        }
      }
      for (const [id, item] of toTrim) {
        this.children.delete(id);
        const parentId = Account.joinDelimitedGroups(
          item.delimitedGroups.slice(0, this.reportPolicy.maxDepth)
        );
        const anc = this._getOrCreateChild(parentId, 1);
        anc._copyTotalsFrom(item);
      }
    }

    if (this.reportPolicy.sumParent) {
      const current = Array.from(this.children.values())
        // VERY IMPORTANT: if unsorted, we run risk of going bottom-up and double count
        .sort((a, b) => a.delimitedGroups.length - b.delimitedGroups.length);
      for (const item of current) {
        const segs = item.delimitedGroups;
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
  accumulateAndValuate(): Maybe {
    this.accumulate();
    return this.valuate();
  }

  protected accumulate(): void {
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

  protected valuate(): Maybe {
    const { currencyConversionService, currencyProvider } = this.aggregator.journal;
    const { valuationStrategy, valuationCurrencyId } = this.reportPolicy;
    const valuationCurrency = valuationCurrencyId ? currencyProvider.getOrCreateCurrencyById(valuationCurrencyId) : undefined;

    if (!valuationCurrency || valuationStrategy === "txnDate") { // txnDate performed at query time
      return Ok;
    }

    for (let i = 0; i < this.additiveSums.length; i++) {
      const period = this.periods[i];

      let valuationDate: number;
      if (typeof valuationStrategy === 'number') {
        valuationDate = valuationStrategy;
      } else if (period.to) {
        valuationDate = period.from ? Math.max(period.to - 1, period.from) : period.to - 1;
      } else {
        return new Error("Valuation at end of period cannot occur for unbounded period end dates.");
      }

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
      const result = child.valuate();
      if (!isOk(result)) {
        return result;
      }
    }

    return Ok;
  }

  /** copy baseline & all additive sums */
  protected _copyTotalsFrom(src: MultiperiodTreeItem): void {
    this.baselineAmount = this.baselineAmount.plus(src.baselineAmount);
    for (let i = 0; i < this.additiveSums.length; i++) {
      this.additiveSums[i] = this.additiveSums[i].plus(src.additiveSums[i]);
    }
  }

  /** get‑or‑create helper (keeps O(1) lookup) */
  protected _getOrCreateChild(id: AccountIdentifier, depth: number): MultiperiodTreeItem {
    const c = this.children.get(id);
    if (!c) {
      const d = new MultiperiodTreeItem(this.aggregator, id, this.reportPolicy, depth);
      this.children.set(id, d);
      return d;
    }
    return c;
  }

  /** drops / aggregates sub‑trees deeper than `maxDepth` */
  protected _pruneToMaxDepth(maxDepth: number): void {
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
  protected _applyMinDepth(minDepth: number): void {
    if (this.depth >= minDepth - 1) return;  // nothing to flatten here

    // collect grandchildren we will promote
    const promoted: MultiperiodTreeItem[] = [];
    for (const child of this.children.values()) {
      child._applyMinDepth(minDepth);
      if (child.depth === minDepth - 1) {
        for (const gc of child.children.values()) {
          promoted.push(gc);
        }
      }
    }

    if (promoted.length) {
      this.children.clear();
      for (const p of promoted) {
        p.promoteRecursive();
        this.children.set(p.accountIdentifier, p);
      }
    }
  }

  protected promoteRecursive() {
    this.depth--;
    for (const gc of this.children.values()) {
      gc.promoteRecursive();
    }
  }

  /** Total across all periods. */
  grandTotalRecursive(): Amount {
    let total = Amount.ZERO;

    for (const a of this.additiveSums) total = total.plus(a);

    for (const child of this.children.values()) {
      total = total.plus(child.grandTotalRecursive());
    }

    return total;
  }

  /**
   * Returns children **in the order requested by ReportPolicy.sortStrategy**.
   * The Map itself is left untouched – ordering is applied only when iterating.
   */
  protected _sortedChildren(): MultiperiodTreeItem[] {
    const kids = Array.from(this.children.values());
    const { sortStrategy } = this.reportPolicy;

    if (sortStrategy === "accountId") {
      kids.sort((a, b) => a.accountIdentifier.localeCompare(b.accountIdentifier));
    } else {
      const asc = sortStrategy === "asc";
      kids.sort((a, b) => {
        const cmp = a.grandTotalRecursive().naiveCompareTo(b.grandTotalRecursive());
        return asc ? cmp : -cmp;
      });
    }
    return kids;
  }

  /* ensure ALL outward‑facing iterations respect the sort order */
  walkChildren(fn: (c: MultiperiodTreeItem) => void): void {
    for (const c of this._sortedChildren()) fn(c);
  }

  walkChildrenRecursive(fn: (c: MultiperiodTreeItem) => void): void {
    for (const c of this._sortedChildren()) {
      fn(c);
      c.walkChildrenRecursive(fn);
    }
  }

  walk(fn: (c: MultiperiodTreeItem) => void): void {
    fn(this);
    this.walkChildren(fn);
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
  protected _allPeriodsZero(): boolean {
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
      ...this.periods.map(p => `"${p.from ? new Date(p.from).toISOString() : '-inf'} => ${p.to ? new Date(p.to).toISOString() : 'inf'}"`)
    ];
    const lines: string[] = [headers.join(",")];

    const treeMode = policy.tree;

    const walk = (node: MultiperiodTreeItem) => {
      if (node.accountIdentifier) {
        const depth = treeMode ? node.depth : 1;
        const row = [
          `"${node.displayedName}"`,
          `"${depth}"`,
          ...node.additiveSums.map(a => `"${displayPrecision < Infinity ? a.toString({ displayPrecision }) : a.toFractionString()}"`)
        ];
        lines.push(row.join(","));
      }
      node.walkChildren(walk);
    };

    this.walkChildren(walk);

    // const row = [
    //   `"Sum"`,
    //   `"0"`,
    //   ...this.additiveSums.map(a => `"${displayPrecision < Infinity ? a.toString({ displayPrecision }) : a.toFractionString()}"`)
    // ];
    // lines.push(row.join(","));

    return lines.join("\n");
  }
}