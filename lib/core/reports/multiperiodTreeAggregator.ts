import { Account, AccountIdentifier } from "../accounting/account.ts";
import { Amount } from "../accounting/amount.ts";
import { Journal } from "../data/journal.ts";
import { Rational } from "../math/rational.ts";
import { isNone, isOk, Maybe, Ok, Result, timestamp } from "../types.ts";
import { ValuationPolicy } from "../valuation/policy.ts";
import { QueryEngineExecutor } from "./query/queryEngineExecutor.ts";
import { Period, ReportPolicy } from "./reportPolicy.ts";

export class MultiperiodTreeAggregator {
  private periods: readonly Period[];
  private rootItem!: MultiperiodTreeItem;

  constructor(
    public readonly journal: Journal,
    private readonly queryEngineExecutor: QueryEngineExecutor,
    private readonly reportPolicy: ReportPolicy,
  ) {
    this.periods = this.reportPolicy.periods();
  }

  execute(): Result<MultiperiodTreeItem> {
    const table = new MultiperiodTable(this.periods, this.reportPolicy);

    this.populateAllAccounts(table);
    this.executeQuery(table);

    // accumulate table buckets
    // valuate
    // invert
    // sum to root bucket
    // max-depth
    // min-depth
    // sum-parent
    // hide-zero
    // put to struct

    this.rootItem = new MultiperiodTreeItem(this.reportPolicy, table);

    // invert
    // accumulate table buckets
    this.invertAccumulate(table);

    // valuate
    const result = this.valuate(table);
    if (!isOk(result)) {
      return result;
    }

    // sum to root bucket
    this.sumToRootBuckets(table);

    // max depth
    if (Number.isFinite(this.reportPolicy.maxDepth)) {
      table.maxDepth();
    }

    // min-depth
    if (this.reportPolicy.minDepth > 1) {
      table.minDepth();
    }

    // sum-parent
    if (this.reportPolicy.sumParent) {
      table.sumParents();
    }

    // hide-zero
    if (this.reportPolicy.hideZero) {
      table.hideZero();
    }

    // put to struct
    table.map.keys().forEach((key) => {
      this.rootItem.putAccount(key);
    });

    this.rootItem.build();

    return this.rootItem;
  }

  debugCSV(dp: number) {
    return this.rootItem.debugCSV(this.reportPolicy, dp);
  }

  private valuate(table: MultiperiodTable): Maybe {
    const { currencyConversionService, currencyProvider } = this.journal;
    const { valuationStrategy, valuationCurrencyId } = this.reportPolicy;
    const valuationCurrency = valuationCurrencyId ? currencyProvider.getOrCreateCurrencyById(valuationCurrencyId) : undefined;

    if (!valuationCurrency || valuationStrategy === "txnDate") { // txnDate performed at query time
      return Ok;
    }

    for (const val of table.map.values()) {
      const { buckets, periods } = val;
      for (let i = 0; i < buckets.length; i++) {
        const period = periods[i];

        let valuationDate: number;
        if (typeof valuationStrategy === 'number') {
          valuationDate = valuationStrategy;
        } else if (period.to) {
          valuationDate = period.from !== undefined ? Math.max(period.to - 1, period.from) : period.to - 1;
        } else {
          return new Error("Valuation at end of period cannot occur for unbounded period end dates.");
        }

        const result = buckets[i].convertToAmount(valuationCurrency, currencyConversionService, new ValuationPolicy(valuationDate));

        if (isNone(result)) {
          // error = new SourceableError(`Failed to convert amount "${amount.toFractionString()}" to currency ${valuationCurrency.id} at transaction primary date.`, posting.transaction.source.sourceText ?? '[Unknown source]');
          // return "stop";

          // ignore
          continue;
        }

        buckets[i] = result;
      }
    }

    return Ok;
  }

  private invertAccumulate(table: MultiperiodTable) {
    table.map.values().forEach((buckets) => {
      if (this.reportPolicy.cumulative) {
        buckets.accumulate();
      }
      if (this.reportPolicy.inversion) {
        buckets.invert();
      }
    });
  }

  private sumToRootBuckets(table: MultiperiodTable) {
    this.rootItem.buckets.clear();

    table.map.values().forEach((buckets) => {
      this.rootItem.buckets.addBucketsFrom(buckets);
    });
  }

  private executeQuery(table: MultiperiodTable) {
    const { displayedAccounts } = this;
    const { currencyConversionService, currencyProvider } = this.journal;
    const { valuationStrategy, valuationCurrencyId } = this.reportPolicy;
    const useLedgObjDate = this.reportPolicy.useLedgObjDate.bind(this.reportPolicy);

    const valuationPolicy = new ValuationPolicy(0);
    const valuationCurrency = valuationCurrencyId ? currencyProvider.getOrCreateCurrencyById(valuationCurrencyId) : undefined;

    this.queryEngineExecutor.executePostings(this.journal, (posting) => {
      let amount = posting.amount;

      const date = useLedgObjDate(posting);

      // We don't wanna create empty entries in rootTreeItem.accept that cause
      // unopened/closed accounts to pop up (via accumulating baseAmount)
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

      table.accept(posting.account.identifier, date, amount)
    });
  }

  private displayedAccounts = new Set<AccountIdentifier>();

  private populateAllAccounts(table: MultiperiodTable) {
    const { accountManager } = this.journal;
    const { reportPolicy } = this;

    let matchedAccounts = new Set(this.queryEngineExecutor.queryAccounts(this.journal));

    if (reportPolicy.reportFrom !== undefined && reportPolicy.reportTo !== undefined) {
      const openedAccounts = accountManager.getAccountsEverOpenedDuringRange(reportPolicy.reportFrom, reportPolicy.reportTo);

      matchedAccounts = matchedAccounts.intersection(openedAccounts);
    }

    this.displayedAccounts = new Set(matchedAccounts.keys().map(x => {
      table.getOrCreateBucket(x.identifier);
      return x.identifier;
    }));
  }
}

export type MultiperiodTableKey = typeof MultiperiodTable.MinDepthHiddenKeys | string;

export function isMinDepthHiddenKey(x: unknown) {
  return MultiperiodTable.isMinDepthHiddenKey(x);
}

class MultiperiodTable {
  static readonly MinDepthHiddenKeys: unique symbol = Symbol("(Upper-level accounts)");

  static isMinDepthHiddenKey(x: unknown): x is typeof MultiperiodTable.MinDepthHiddenKeys {
    return x === MultiperiodTable.MinDepthHiddenKeys;
  }

  map = new Map<MultiperiodTableKey, MultiperiodTableBuckets>();

  constructor(
    readonly periods: readonly Period[],
    readonly policy: ReportPolicy,
  ) {}

  getOrCreateBucket(key: MultiperiodTableKey): MultiperiodTableBuckets {
    let result = this.map.get(key);
    if (!result) {
      this.map.set(key, result = new MultiperiodTableBuckets(this.periods, this.policy));
    }
    return result;
  }

  accept(accountId: AccountIdentifier, ts: timestamp, amount: Amount) {
    this.getOrCreateBucket(accountId).accept(ts, amount);
  }

  sumParents() {
    const copy = new MultiperiodTable(this.periods, this.policy);

    for (const [key, buckets] of this.map.entries()) {
      if (MultiperiodTable.isMinDepthHiddenKey(key)) {
        // there's no parent to the "(Upper-level accounts)"
        copy.map.set(key, buckets);
        continue;
      }

      const splitGroups = Account.splitIdentifier(key);

      // Recursively put a single entire path to tree
      const currentPath = [];
      for (let i = 0; i < splitGroups.length; i++) {
        currentPath.push(splitGroups[i]);

        const distKey = Account.joinDelimitedGroups(currentPath);
        copy.getOrCreateBucket(distKey).addBucketsFrom(buckets);
      }
    }

    this.map = copy.map;
  }

  hideZero() {
    for (const [key, buckets] of this.map.entries()) {
      if (buckets.isAllZero()) {
        this.map.delete(key);
      }
    }
  }

  minDepth() {
    const copy = new MultiperiodTable(this.periods, this.policy);

    const depth = this.policy.minDepth;

    const hiddenBuckets = copy.getOrCreateBucket(MultiperiodTable.MinDepthHiddenKeys);

    let hasAccount = false;

    for (const [key, buckets] of this.map.entries()) {
      if (MultiperiodTable.isMinDepthHiddenKey(key)) {
        continue;
      }

      const splitGroups = Account.splitIdentifier(key);
      if (splitGroups.length < depth) {
        hasAccount = true;

        hiddenBuckets.addBucketsFrom(buckets);
      } else {
        copy.map.set(Account.joinDelimitedGroups(splitGroups.slice(depth - 1)), buckets);
      }
    }

    if (!hasAccount) {
      // ^ We shouldn't rely on hide-zero since if user has --hz=false, we still
      // shouldn't show this if there's no depth < min-depth accounts. But if
      // there's accounts, we should show them and whether they have amounts in
      // them is hide-zero's job.
      copy.map.delete(MultiperiodTable.MinDepthHiddenKeys);
    }

    this.map = copy.map;
  }

  maxDepth() {
    const copy = new MultiperiodTable(this.periods, this.policy);

    const depth = this.policy.maxDepth;

    for (const [key, buckets] of this.map.entries()) {
      if (MultiperiodTable.isMinDepthHiddenKey(key)) {
        // there's no parent to the "(Upper-level accounts)"
        copy.map.set(key, buckets);
        continue;
      }

      const splitGroups = Account.splitIdentifier(key);
      let dist = key;
      if (splitGroups.length > depth) {
        dist = Account.joinDelimitedGroups(splitGroups.slice(0, depth))
      }

      copy.getOrCreateBucket(dist).addBucketsFrom(buckets);
    }

    this.map = copy.map;
  }
}


class MultiperiodTableBuckets {
  baseAmount: Amount = Amount.ZERO;
  readonly buckets: Amount[] = [];

  constructor(
    readonly periods: readonly Period[],
    readonly policy: ReportPolicy,
  ) {
    this.clear();
  }

  clear() {
    this.baseAmount = Amount.ZERO;
    for (let i = 0;i < this.periods.length;i++) {
      this.buckets[i] = Amount.ZERO;
    }
  }

  accept(ts: timestamp, amount: Amount) {
    const policy = this.policy;

    const bucketIdx = policy.bucketIndex(ts);

    if (bucketIdx >= 0) {
      this.buckets[bucketIdx] = this.buckets[bucketIdx].plus(amount);
    }

    if (policy.cumulative && policy.reportFrom && ts < policy.reportFrom) {
      this.baseAmount = this.baseAmount.plus(amount);
    }
  }

  accumulate() {
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i] = this.buckets[i].plus(i == 0 ? this.baseAmount : this.buckets[i - 1]);
    }
  }
  invert() {
    this.baseAmount = this.baseAmount.times(Rational.NEGATIVE_ONE);
    for (let i = 0; i < this.buckets.length; i++) {
      this.buckets[i] = this.buckets[i].times(Rational.NEGATIVE_ONE);
    }
  }

  addBucketsFrom(buckets: MultiperiodTableBuckets) {
    buckets.buckets.forEach((val, idx) => {
      this.buckets[idx] = this.buckets[idx].plus(val);
    });
  }

  bucketsTotal(): Amount {
    return this.buckets.reduce((prev, cur) => prev.plus(cur), Amount.ZERO);
  }

  debugStrings() {
    return this.buckets.map(a => a.toString());
  }

  isAllZero(): boolean {
    for (const a of this.buckets) {
      if (!a.isStrictlyZero()) {
        return false;
      }
    }
    return true;
  }
}

export class MultiperiodTreeItem {
  public buckets: MultiperiodTableBuckets;
  public readonly periods: readonly Period[];

  public selfTotal: Amount = Amount.ZERO;
  public childrenTotal: Amount = Amount.ZERO;
  public grandTotal: Amount = Amount.ZERO;

  public children = new Map<MultiperiodTableKey, MultiperiodTreeItem>();

  constructor(
    public readonly reportPolicy: ReportPolicy,
    public readonly trackingTable: MultiperiodTable,
    public readonly trackKey?: MultiperiodTableKey,
    public depth = 0,
  ) {
    this.periods = reportPolicy.periods();
    this.buckets = new MultiperiodTableBuckets(this.periods, reportPolicy);
  }

  putAccount(key: MultiperiodTableKey) {
    if (MultiperiodTable.isMinDepthHiddenKey(key)) {
      if (this.depth !== 0) throw 'FATAL. ParentSymbol encountered at sub-root level.';

      this.children.set(key, this.getOrCreateDirectChild(key));
      return;
    }

    if (!this.reportPolicy.tree) {
      this.children.set(key, this.getOrCreateDirectChild(key));
      return;
    }

    const splitGroups = Account.splitIdentifier(key);

    // Recursively put a single entire path to tree
    const parentGroups = [];
    let parent: MultiperiodTreeItem = this;
    for (let i = 0;i < splitGroups.length;i++) {
      parentGroups.push(splitGroups[i]);

      const childKey = Account.joinDelimitedGroups(parentGroups);
      parent = parent.getOrCreateDirectChild(childKey);
    }
  }

  build() {
    this.buckets = this.trackKey ?
      this.trackingTable.getOrCreateBucket(this.trackKey) :
      this.buckets; // retain root-level buckets summed by Aggregator

    this.selfTotal = this.buckets.bucketsTotal();

    this.walkChildrenInternal(x => {
      x.build();

      this.childrenTotal = this.childrenTotal.plus(x.selfTotal);
    });

    this.grandTotal = this.selfTotal.plus(this.childrenTotal);
  }

  get displayedName(): MultiperiodTableKey {
    if (!this.trackKey) {
      return "";
    }

    if (MultiperiodTable.isMinDepthHiddenKey(this.trackKey)) {
      return this.trackKey;
    }

    if (!this.reportPolicy.tree) {
      return this.trackKey;
    }

    return Account.splitIdentifier(this.trackKey).at(-1) ?? this.trackKey;
  }

  get displayedAmounts(): Amount[] {
    return this.buckets.buckets;
  }

  walkChildrenRecursive(fn: (c: MultiperiodTreeItem) => void) {
    const children = this.sortedChildren();
    for (const child of children) {
      fn(child); // Top-down order
      child.walkChildrenRecursive(fn);
    }
  }

  private sortedChildren(): MultiperiodTreeItem[] {
    const kids = Array.from(this.children.values());
    const { sortStrategy } = this.reportPolicy;

    if (sortStrategy === "accountId") {
      // "(Upper-level accounts)" is last
      kids.sort((a, b) => typeof a.trackKey == 'symbol' ? 1 : typeof b.trackKey == 'symbol' ? -1 : a.trackKey!.localeCompare(b.trackKey!))
    } else {
      const asc = sortStrategy === "asc";
      kids.sort((a, b) => {
        const cmp = a.grandTotal.naiveCompareTo(b.grandTotal);
        return asc ? cmp : -cmp;
      });
    }
    return kids;
  }

  private walkChildrenInternal(fn: (c: MultiperiodTreeItem) => void) {
    for (const child of this.children.values()) {
      fn(child);
    }
  }

  private getOrCreateDirectChild(key: MultiperiodTableKey): MultiperiodTreeItem {
    let result = this.children.get(key);
    if (!result) {
      this.children.set(key, result = new MultiperiodTreeItem(
        this.reportPolicy,
        this.trackingTable,
        key,
        this.depth + 1
      ));
    }
    return result;
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
      if (node.depth > 0) {
        const depth = treeMode ? node.depth : 1;
        const row = [
          `"${node.displayedName.toString()}"`,
          `"${depth}"`,
          ...node.displayedAmounts.map(a => `"${displayPrecision < Infinity ? a.toString({ displayPrecision }) : a.toFractionString()}"`)
        ];
        lines.push(row.join(","));
      }
    };

    this.walkChildrenRecursive(walk);

    return lines.join("\n");
  }
}