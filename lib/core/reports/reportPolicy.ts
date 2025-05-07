import { timestamp } from "../types.ts";
import { Currency } from "../valuation/currency.ts";
import { QueryPolicy } from "./query/queryPolicy.ts";

/**
 * Valuation strategy that amount conversions should occur.
 *   - eop - at End of Reporting Period
 *   - txnDate - at the primary date of the transaction (since
 *     TransactionValidationService mandates that the transaction must balance
 *     at transaction primary date)
 *   - `timestamp` - any custom valuation date
 */
export type ValuationStrategy = "eop" | "txnDate" | timestamp;

export class ReportPolicy extends QueryPolicy {
  /**
   * The period interval within the `from` -> `to` window.
   */
  reportPeriodInterval?: ReportPeriodInterval;

  /**
   * The currency that all amounts should be convert to in a report. Undefined
   * value leaves amounts unconverted.
   */
  valuationCurrency?: Currency;

  valuationStrategy: ValuationStrategy = "txnDate";

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

  private _periods?: Period[];
  private _indexer?: PeriodIndexer;

  /**
   * Returns immutable list of period buckets, lazily computed.
   * Each bucket is `[from, to)` capped to [`this.from`, `this.to`].
   */
  periods(): readonly Period[] {
    if (!this.reportPeriodInterval) {
      throw new Error("reportPeriodInterval not set");
    }
    if (!this.from || !this.to) {
      throw new Error("`from` and `to` must be defined on ReportPolicy");
    }
    if (!this._periods) {
      this._periods = new PeriodCalculator(
        this.from,
        this.to,
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
