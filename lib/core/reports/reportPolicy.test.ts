import { describe, it, expect } from 'vitest';
import { Period, ReportPeriodInterval, ReportPolicy } from './reportPolicy.ts';

const ts = (isoDate: string): number => Date.parse(`${isoDate}Z`);

function buildPolicy(from: string, to: string, intv: ReportPeriodInterval): ReportPolicy {
  return new ReportPolicy()
    .withReportFrom(ts(from))
    .withReportTo(ts(to))
    .withReportPeriodInterval(intv.dayInterval, intv.monthInterval, intv.yearInterval);
}


describe('ReportPolicy - validations', () => {
  it('throws if period interval not set before calling periods()', () => {
    const rp = new ReportPolicy().withReportFrom(ts('2024-01-01')).withReportTo(ts('2024-01-31'));
    expect(() => rp.periods()).toThrow(/reportPeriodInterval not set/);
  });

  it('throws if from/to undefined', () => {
    const rp = new ReportPolicy();
    rp.withReportPeriodInterval(1, 0, 0);
    expect(() => rp.periods()).toThrow(/`reportFrom` and `reportTo` must be defined/);
  });

  it('throws if interval is all zeros', () => {
    const rp = new ReportPolicy()
      .withReportFrom(ts('2024-01-01'))
      .withReportTo(ts('2024-01-10'))
      .withReportPeriodInterval(0, 0, 0);
    expect(() => rp.periods()).toThrow(/not set/);
  });

  it('throws if to <= from', () => {
    // to === from
    expect(() =>
      new ReportPolicy()
        .withReportFrom(ts('2024-01-01'))
        .withReportTo(ts('2024-01-01'))
        .withReportPeriodInterval(1, 0, 0)
        .periods(),
    ).toThrow(/`to` must be > `from`/);

    // to < from
    expect(() =>
      new ReportPolicy()
        .withReportFrom(ts('2024-02-01'))
        .withReportTo(ts('2024-01-01'))
        .withReportPeriodInterval(1, 0, 0)
        .periods(),
    ).toThrow(/`to` must be > `from`/);
  });
});

describe('ReportPolicy - day interval accuracy', () => {
  it('creates correct number of 1-day buckets and bucketIndex mapping', () => {
    const rp = buildPolicy('2024-01-01', '2024-01-04', new ReportPeriodInterval(1)); // 3 days
    const periods = rp.periods();
    expect(periods).toHaveLength(3);
    expect(periods.map(p => [p.from, p.to])).toEqual([
      [ts('2024-01-01'), ts('2024-01-02')],
      [ts('2024-01-02'), ts('2024-01-03')],
      [ts('2024-01-03'), ts('2024-01-04')],
    ]);

    // Each midnight lands in correct bucket
    expect(rp.bucketIndex(ts('2024-01-01'))).toBe(0);
    expect(rp.bucketIndex(ts('2024-01-02'))).toBe(1);
    expect(rp.bucketIndex(ts('2024-01-03'))).toBe(2);

    // Out‑of‑range
    expect(rp.bucketIndex(ts('2023-12-31'))).toBe(-1);
    expect(rp.bucketIndex(ts('2024-01-04'))).toBe(-1); // exclusive upper bound
  });

  it('handles multi-day intervals (weekly) correctly', () => {
    const rp = buildPolicy('2024-01-01', '2024-02-01', new ReportPeriodInterval(7));
    const periods = rp.periods();
    // Jan has 31 days => 5 periods (7*4 = 28 + final 3‑day stub)
    expect(periods).toHaveLength(5);

    // Check first & last period boundaries
    expect(periods[0]).toEqual(new Period(ts('2024-01-01'), ts('2024-01-08')));
    expect(periods[4]).toEqual(new Period(ts('2024-01-29'), ts('2024-02-01')));

    // bucketIndex inside each period - use a mid‑point day to avoid boundary ambiguity
    for (let i = 0; i < periods.length; i++) {
      const mid = periods[i].from + Math.floor((periods[i].to - periods[i].from) / 2);
      expect(rp.bucketIndex(mid)).toBe(i);
    }
  });
});

describe('ReportPolicy - month interval accuracy', () => {
  it('creates consecutive 1-month buckets starting mid-month', () => {
    const rp = buildPolicy('2024-01-15', '2024-04-15', new ReportPeriodInterval(0, 1));
    const periods = rp.periods();
    expect(periods).toHaveLength(3);

    expect(periods[0]).toEqual(new Period(ts('2024-01-15'), ts('2024-02-15')));
    expect(periods[1]).toEqual(new Period(ts('2024-02-15'), ts('2024-03-15')));
    expect(periods[2]).toEqual(new Period(ts('2024-03-15'), ts('2024-04-15')));

    // Check indexes
    expect(rp.bucketIndex(ts('2024-01-14'))).toBe(-1); // before range
    expect(rp.bucketIndex(ts('2024-02-14'))).toBe(0);
    expect(rp.bucketIndex(ts('2024-02-15'))).toBe(1); // boundary inclusive of next
    expect(rp.bucketIndex(ts('2024-03-31'))).toBe(2);
    expect(rp.bucketIndex(ts('2024-04-14'))).toBe(2);
    expect(rp.bucketIndex(ts('2024-04-15'))).toBe(-1); // exclusive upper bound
  });

  it('handles leap-year February correctly', () => {
    const rp = buildPolicy('2024-02-29', '2024-05-29', new ReportPeriodInterval(0, 1));
    const periods = rp.periods();
    // 3 months inclusive Feb‑Mar, Mar‑Apr, Apr‑May
    expect(periods).toHaveLength(3);

    expect(periods[0]).toEqual(new Period(ts('2024-02-29'), ts('2024-03-29')));
    expect(periods[1]).toEqual(new Period(ts('2024-03-29'), ts('2024-04-29')));
    expect(periods[2]).toEqual(new Period(ts('2024-04-29'), ts('2024-05-29')));

    // Ensure bucketIndex across boundaries works
    expect(rp.bucketIndex(ts('2024-03-28'))).toBe(0);
    expect(rp.bucketIndex(ts('2024-03-29'))).toBe(1);
    expect(rp.bucketIndex(ts('2024-05-28'))).toBe(2);
  });
});

describe('ReportPolicy - year interval accuracy', () => {
  it('creates 2-year buckets correctly', () => {
    const rp = buildPolicy('2000-01-01', '2006-01-01', new ReportPeriodInterval(0, 0, 2));
    const periods = rp.periods();
    expect(periods).toHaveLength(3);
    expect(periods[0]).toEqual(new Period(ts('2000-01-01'), ts('2002-01-01')));
    expect(periods[1]).toEqual(new Period(ts('2002-01-01'), ts('2004-01-01')));
    expect(periods[2]).toEqual(new Period(ts('2004-01-01'), ts('2006-01-01')));

    // Index spot checks
    expect(rp.bucketIndex(ts('2000-01-01'))).toBe(0);
    expect(rp.bucketIndex(ts('2000-01-31'))).toBe(0);
    expect(rp.bucketIndex(ts('2000-12-31'))).toBe(0);
    expect(rp.bucketIndex(ts('2001-01-01'))).toBe(0);
    expect(rp.bucketIndex(ts('2001-01-31'))).toBe(0);
    expect(rp.bucketIndex(ts('2001-12-31'))).toBe(0);
    expect(rp.bucketIndex(ts('2002-01-01'))).toBe(1);
    expect(rp.bucketIndex(ts('2002-01-31'))).toBe(1);
    expect(rp.bucketIndex(ts('2002-01-21'))).toBe(1);
    expect(rp.bucketIndex(ts('2002-01-10'))).toBe(1);
    expect(rp.bucketIndex(ts('2002-12-31'))).toBe(1);
    expect(rp.bucketIndex(ts('2003-12-31'))).toBe(1);
    expect(rp.bucketIndex(ts('2005-12-31'))).toBe(2);
    expect(rp.bucketIndex(ts('2006-01-01'))).toBe(-1);
    expect(rp.bucketIndex(ts('1999-01-01'))).toBe(-1);
    expect(rp.bucketIndex(ts('2000-01-01') - 1)).toBe(-1);
    expect(rp.bucketIndex(ts('2000-01-01') - 2)).toBe(-1);
    expect(rp.bucketIndex(ts('2000-01-01') - 1000)).toBe(-1);
  });
});

describe('ReportPolicy - mixed interval fallback', () => {
  it('creates mixed 1 month + 10 day buckets and indexes correctly', () => {
    const rp = buildPolicy('2023-01-01', '2023-06-01', new ReportPeriodInterval(10, 1));
    const periods = rp.periods();

    // Build periods manually for assertion reliability
    const expected: Period[] = [];
    let cur = ts('2023-01-01');
    while (cur < ts('2023-06-01')) {
      const nextDate = new Date(cur);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      nextDate.setUTCDate(nextDate.getUTCDate() + 10);
      expected.push(new Period(cur, Math.min(nextDate.getTime(), ts('2023-06-01'))));
      cur = nextDate.getTime();
    }

    expect(periods).toEqual(expected);

    // Test bucketIndex on 20 random timestamps inside range
    for (let i = 0; i < 20; i++) {
      const randTs = ts('2023-01-01') + Math.floor(Math.random() * (ts('2023-06-01') - ts('2023-01-01')));
      const idx = periods.findIndex(p => p.contains(randTs));
      expect(rp.bucketIndex(randTs)).toBe(idx);
    }
  });
});

describe('ReportPolicy - lazy build + idempotence', () => {
  it('calling bucketIndex before periods() still yields consistent results & does not rebuild', () => {
    const rp = buildPolicy('2024-01-01', '2024-01-05', new ReportPeriodInterval(1));

    // First call bucketIndex (triggers internal build lazily)
    const firstIdx = rp.bucketIndex(ts('2024-01-02'));
    expect(firstIdx).toBe(1);

    // Subsequent periods() should return a memoized array, same object reference
    const p1 = rp.periods();
    const p2 = rp.periods();
    expect(p1).toBe(p2);
  });
});

describe('ReportPolicy - single-period mode', () => {
  it('creates exactly one bucket that spans the full range', () => {
    const rp = new ReportPolicy()
      .withReportFrom(ts('2024-01-01'))
      .withReportTo(ts('2024-01-10'))
      .withSingleReportPeriod();

    const periods = rp.periods();
    expect(periods).toHaveLength(1);
    expect(periods[0]).toEqual(
      new Period(ts('2024-01-01'), ts('2024-01-10')),
    );

    // bucketIndex mapping
    expect(rp.bucketIndex(ts('2024-01-05'))).toBe(0);  // inside
    expect(rp.bucketIndex(ts('2024-01-10'))).toBe(-1); // upper bound exclusive
    expect(rp.bucketIndex(ts('2023-12-31'))).toBe(-1); // below range
  });

  it('wins over a previous withReportPeriodInterval() call (last-call-wins)', () => {
    const rp = new ReportPolicy()
      .withReportFrom(ts('2024-05-01'))
      .withReportTo(ts('2024-05-15'))
      .withReportPeriodInterval(1, 0, 0) // daily – will be overridden
      .withSingleReportPeriod();

    expect(rp.periods()).toHaveLength(1);
  });

  it('still validates from/to > 0 and throws when invalid', () => {
    const rp = new ReportPolicy()
      .withReportFrom(ts('2024-01-01'))
      .withReportTo(ts('2024-01-01')) // equal → invalid
      .withSingleReportPeriod();

    expect(() => rp.periods()).toThrow(/`to` must be > `from`/);
  });
});