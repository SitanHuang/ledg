import { timestamp } from "../types.ts";
import { Currency } from "../valuation/currency.ts";
import { QueryPolicy } from "./query/queryPolicy.ts";

export type ValuationStrategy = "eop" | "txnDate" | timestamp;
export type SortStrategy = "accountId" | "asc" | "desc";

export class ReportPolicy extends QueryPolicy {
  /**
   * Inclusive, min date. Can NOT be plus/minus infinity. This differs from
   * QueryPolicy.from, which is the low-level filtering for postings, as the
   * report's starting period date.
   */
  reportFrom?: timestamp;
  /**
   * Exclusive, max date. Can NOT be plus/minus infinity. This differs from
   * QueryPolicy.to, which is the low-level filtering for postings, as the
   * report's ending period date.
   */
  reportTo?: timestamp;

  /**
   * The period interval within the `from` -> `to` window.
   */
  reportPeriodInterval?: ReportPeriodInterval;

  /**
   * The currency that all amounts should be convert to in a report. Undefined
   * value leaves amounts unconverted.
   */
  valuationCurrency?: Currency;

  /**
   * Valuation strategy that amount conversions should occur.
   *   - eop - at End of Reporting Period
   *   - txnDate - at the primary date of the transaction (since
   *     TransactionValidationService mandates that the transaction must balance
   *     at transaction primary date)
   *   - `timestamp` - any custom valuation date
   */
  valuationStrategy: ValuationStrategy = "txnDate";

  /**
   * A cumulative report aggregates the sum of each period from all periods
   * before it.
   */
  cumulative = false;

  /**
   * Accumulates sub-account totals to their parents. Under `tree`=false, new
   * entries will be added for every parent.
   */
  sumParent = false;

  /**
   * Maximum depth of account levels displayed. Regardless of the `sumParent`
   * option, accounts below the `maxDepth` will be summed to their parents.
   *
   * Tree view example:
   *   ```
   *   Expense 0
   *     Car   1
   *       Gas 2
   *   ```
   *
   *   With maxDepth=2, becomes:
   *   ```
   *   Expense 0
   *     Car   3
   *   ```
   *
   */
  maxDepth = Infinity;

  /**
   * Minimum depth of top-level display items.
   *
   * Tree-view example:
   *   ```
   *   Expense 0
   *     Car   1
   *       Gas 2
   *   ```
   *
   *   With minDepth=2, becomes:
   *   ```
   *   Expense.Car  1
   *     Gas        2
   *   ```
   *
   * In non-tree-view mode, `minDepth` has no effects UNLESS `sumParent` is
   * enabled. In that case, the sumParent will stop at the requested `minDepth`.
   * Example:
   *
   *   ```
   *   Expense.Car     1
   *   Expense.Car.Gas 2
   *   ```
   *
   *   With minDepth=2 & sumParent=true, becomes:
   *   ```
   *   Expense.Car     3
   *   Expense.Car.Gas 2
   *   ```
   *   With minDepth=0 & sumParent=true, becomes:
   *   ```
   *   Expense         3
   *   Expense.Car     3
   *   Expense.Car.Gas 2
   *   ```
   *
   */
  minDepth = 0;

  /**
   * Hides any entries with zero amounts, regardless of account status.
   */
  hideZero = false;

  /**
   * Enables account tree view.
   */
  tree = false;

  /**
   * Sorting strategy of the report.
   *   - "accountId" - sorts by account identifier in ascending order
   *   - "asc" | "desc" - sorts by total aggregate amount in
   *     ascending/descending order across all periods
   */
  sortStrategy: SortStrategy = "accountId";

  withSortStrategy(strategy: SortStrategy): this {
    this.sortStrategy = strategy;
    return this;
  }

  withValutionCurrency(currency: Currency): this {
    this.valuationCurrency = currency;
    return this;
  }

  withValutionStrategy(strategy: ValuationStrategy): this {
    this.valuationStrategy = strategy;
    return this;
  }

  withReportPeriodInterval(dayInterval: timestamp, monthInterval: timestamp, yearInterval: timestamp): this {
    this.reportPeriodInterval = new ReportPeriodInterval(dayInterval, monthInterval, yearInterval);
    return this;
  }

  withSumParent(sumParent: boolean): this {
    this.sumParent = sumParent;
    return this;
  }

  withMaxDepth(maxDepth: number): this {
    this.maxDepth = maxDepth;
    return this;
  }

  withMinDepth(minDepth: number): this {
    this.minDepth = minDepth;
    return this;
  }

  withCumulative(cumulative: boolean): this {
    this.cumulative = cumulative;
    return this;
  }

  withHideZero(hideZero: boolean): this {
    this.hideZero = hideZero;
    return this;
  }

  withTree(tree: boolean): this {
    this.tree = tree;
    return this;
  }

  withReportFrom(reportFrom: timestamp): this {
    this.reportFrom = reportFrom;
    return this;
  }

  withReportTo(reportTo: timestamp): this {
    this.reportTo = reportTo;
    return this;
  }

  private _periods?: Period[];
  private _indexer?: PeriodIndexer;

  /**
   * Returns immutable list of period buckets, lazily computed.
   * Each bucket is `[from, to)` capped to [`this.reportFrom`, `this.reportTo`].
   */
  periods(): readonly Period[] {
    if (!this.reportPeriodInterval) {
      throw new Error("reportPeriodInterval not set");
    }
    if (!this.reportFrom || !this.reportTo) {
      throw new Error("`reportFrom` and `reportTo` must be defined on ReportPolicy");
    }
    if (!this._periods) {
      this._periods = new PeriodCalculator(
        this.reportFrom,
        this.reportTo,
        this.reportPeriodInterval,
      ).build();
      this._indexer = new PeriodIndexer(this._periods, this.reportPeriodInterval);
    }
    return this._periods;
  }

  /**
   * O(1) bucket index for a timestamp, or -1 if outside the report range.
   */
  bucketIndex(ts: timestamp): number {
    if (!this._indexer) this.periods(); // triggers lazy build
    return this._indexer!.indexOf(ts);
  }
}

export class ReportPeriodInterval {
  constructor(
    public dayInterval = 0,
    public monthInterval = 0,
    public yearInterval = 0,
  ) {}
}

export class Period {
  readonly from: timestamp; // inclusive
  readonly to: timestamp; // exclusive

  constructor(from: timestamp, to: timestamp) {
    if (to <= from) {
      throw new RangeError("Period `to` must be after `from`");
    }

    this.from = from;
    this.to = to;
  }

  contains(ts: timestamp): boolean {
    return ts >= this.from && ts < this.to;
  }
}

function addToDate(
  d: Date,
  years = 0,
  months = 0,
  days = 0,
): Date {
  const nd = new Date(d.getTime());

  nd.setUTCFullYear(nd.getUTCFullYear() + years);
  nd.setUTCMonth(nd.getUTCMonth() + months);
  nd.setUTCDate(nd.getUTCDate() + days);

  return nd;
}

// function monthsBetween(a: Date, b: Date): number {
//   return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + // year
//     (b.getUTCMonth() - a.getUTCMonth()) // month
//     - (b.getUTCDate() < a.getUTCDate() ? 1 : 0); // if end's day is before start’s day, it isn't a full month yet
// }

const MS_PER_DAY = 86_400_000;

/**
 * Builds an array of consecutive Period objects that exactly cover the window
 * [`from`, `to`) using the supplied interval.
 */
class PeriodCalculator {
  private readonly start!: Date;
  private readonly end!: Date;
  private readonly intv!: ReportPeriodInterval;

  constructor(from: timestamp, to: timestamp, intv: ReportPeriodInterval) {
    if (to <= from) {
      throw new RangeError("`to` must be > `from`");
    }
    this.start = new Date(from);
    this.end = new Date(to);
    this.intv = intv;
  }

  build(): Period[] {
    const { yearInterval, monthInterval, dayInterval } = this.intv;
    if (yearInterval === 0 && monthInterval === 0 && dayInterval === 0) {
      throw new Error("ReportPeriodInterval cannot be all zeros");
    }

    const periods: Period[] = [];
    let curStart = this.start;

    while (curStart < this.end) {
      const nxt = addToDate(
        curStart,
        yearInterval,
        monthInterval,
        dayInterval,
      );
      const curEndMs = Math.min(nxt.getTime(), this.end.getTime());
      periods.push(new Period(curStart.getTime(), curEndMs));
      curStart = nxt;
    }
    return periods;
  }
}

class PeriodIndexer {
  /**
   * Sorted periods.
   */
  private readonly periods: readonly Period[];
  private readonly intv: ReportPeriodInterval;
  private readonly baseDate: Date;
  private readonly msPerDayIntv: number; // pre‑calc for day‑only path
  private readonly totalMonthsIntv: number;

  constructor(periods: readonly Period[], intv: ReportPeriodInterval) {
    this.periods = periods;
    this.intv = intv;
    this.baseDate = new Date(periods[0].from);
    this.msPerDayIntv = intv.dayInterval * MS_PER_DAY;
    this.totalMonthsIntv = intv.yearInterval * 12 + intv.monthInterval;

    // this is needed for binary search
    for (let i = 1;i < periods.length;i++) {
      if (periods[i].from <= periods[i - 1].from || periods[i].to <= periods[i - 1].to) {
        throw new Error("Report periods must be increasing.")
      }
    }
  }

  /**
   * Returns -1 when ts is out of range.
   */
  indexOf(ts: timestamp): number {
    if (ts < this.periods[0].from || ts >= this.periods[this.periods.length - 1].to) {
      return -1;
    }

    // Fast, O(1) path - uniform *day* intervals; experimentally proven to be
    // faster than binary search at all period lengths
    if (this.intv.dayInterval > 0 && this.totalMonthsIntv === 0) {
      const idx = Math.floor((ts - this.periods[0].from) / this.msPerDayIntv);
      return idx < this.periods.length && this.periods[idx].contains(ts) ? idx : -1;
    }

    // if (this.periods.length > 131072) { // 131072 is experimentally proven lmao
    //   // O(1) path - uniform month/year intervals (no day component)
    //   if (this.intv.dayInterval === 0 && this.totalMonthsIntv > 0) {
    //     const tsDate = new Date(ts);
    //     const mDiff = monthsBetween(this.baseDate, tsDate);
    //     const idx = Math.floor(mDiff / this.totalMonthsIntv);
    //     return idx < this.periods.length && this.periods[idx].contains(ts) ? idx : -1;
    //   }
    // }

    // Mixed interval fallback - O(log(n))
    return this.mapFallback(ts);
  }

  /**
   * Binary search over periods.
   */
  private mapFallback(ts: number): number {
    const periods = this.periods;
    let lo = 0;
    let hi = periods.length - 1;

    while (lo <= hi) {
      // unsigned right-shift is a fast way to floor((lo + hi) / 2)
      const mid = (lo + hi) >>> 1;
      const p = periods[mid];

      if (ts < p.from) {
        hi = mid - 1;
      } else if (ts >= p.to) {
        lo = mid + 1;
      } else {
        return mid;
      }
    }

    return -1;
  }
}
