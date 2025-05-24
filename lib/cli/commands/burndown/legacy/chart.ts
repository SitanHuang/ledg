// Transcribed code from legacy chart.js

import ansis, { Ansis } from 'ansis';
import { Amount, Currency, Maybe, Ok, Period, Rational, ReportPeriodInterval, timestamp, toUTCMidnight } from '../../../../core/namespace.ts';

interface Row extends Array<string> {
  underline?: boolean;
}

class Chart {
  protected buffer: Row[] = [];
  protected zeroRow?: number;

  constructor() {
    this.buffer = [];
  }

  replace(row: number, col: number, str: string, fillSpaceOnly = false): void {
    for (let i = 0; i < str.length; i++) {
      if (fillSpaceOnly) {
        this.buffer[row][col + i] = this.buffer[row][col + i].replace(' ', str[i]);
      } else {
        this.buffer[row][col + i] = str[i];
      }
    }
  }

  render(): string {
    return '\n' +
      this.buffer
        .map((r, i) =>
          i === this.zeroRow || r.underline
            ? ansis.underline(r.join(''))
            : r.join('')
        )
        .join('\n');
  }
}

interface Series {
  name: string;
  amounts: readonly Amount[];
  rationals: Rational[];
}

export class BarChart extends Chart {
  readonly series: Series[] = [];

  detectedCurrency?: Currency;
  min: Rational = Rational.ZERO;
  max: Rational = Rational.ZERO;
  div: Rational = Rational.ZERO;

  constructor(
    readonly periods: readonly Period[],
    readonly reportInterval: ReportPeriodInterval,
  ) { super(); }

  addSeries(name: string, amounts: readonly Amount[]): Maybe {
    if (amounts.length !== this.periods.length) {
      return new Error("FATAL: Period length != series data length.");
    }

    const rationals = Array<Rational>(amounts.length).fill(Rational.ZERO);

    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i].getEntries();

      if (amount.length == 0) continue;
      if (amount.length > 1) {
        return new Error(`Cannot coerce a multicurrency amount [${amounts[i].toFractionString()}] to a rational.`);
      }

      const currency = amount[0].currency;

      this.detectedCurrency = this.detectedCurrency ?? currency;

      if (this.detectedCurrency.id !== currency.id) {
        return new Error(`The amount [${amounts[i].toFractionString()}] contains a different currency that the previously detected currency of "${this.detectedCurrency.id}" earlier in the data.`);
      }

      const val = rationals[i] = amount[0].value;

      this.min = Rational.min(this.min, val);
      this.max = Rational.max(this.max, val);
    }

    this.series.push({
      name, amounts, rationals
    });

    return Ok;
  }

  build(): Maybe {
    const { series, periods, reportInterval, max, min, buffer } = this;
    const { dayInterval, monthInterval, yearInterval } = reportInterval;

    const termRows = process.stdout.rows ?? 0;
    const termCols = process.stdout.columns ?? 0;

    const maxIntervals = (termCols - 8) / (series.length * 2 + 1) | 0;

    if (periods.length > maxIntervals) {
      return new Error(`Terminal is too small for ${periods.length} intervals, max ${maxIntervals}.`);
    }

    const drawDays = dayInterval > 0 && Number.isFinite(dayInterval);
    const drawWeeks = dayInterval >= 7 && dayInterval % 7 === 0;
    let drawMonths = false;
    let drawYears = false;

    const width = termCols;
    const height = termRows - (drawWeeks ? 7 : 5);

    // const gWidth = width - 7;
    const gHeight = height - 3 - 2;

    const range = Rational.abs(max.minus(min));
    const div = this.div = range.div(gHeight);
    const zeroRow = this.zeroRow = max.div(div).round(0n).toNumber();

    for (let i = 0; i <= gHeight + 1; i++) {
      buffer[i] = [];
      if (i == 0 || i == gHeight || i == zeroRow)
        this.drawYLabel(i);
      for (let j = 0; j < width; j++)
        if (j == 6)
          buffer[i][j] = "│";
        else
          buffer[i][j] = buffer[i][j] || ' ';
    }

    const plcs = this.numDigits(max);

    const n = new Rational(10n ** BigInt(plcs - 1), 4n);
    for (let i = n; i.lt(max); i = i.plus(n)) {
      const row = max.minus(i).div(div).round(0).toNumber();
      this.drawYLabel(row, i);
    }
    for (let i = n.times(Rational.NEGATIVE_ONE); i.gt(min); i = i.minus(n)) {
      const row = zeroRow - i.div(div).round(0).toNumber() + 1;
      this.drawYLabel(row, i);
    }

    const dataSets = series.length;
    for (let p = periods.length - 1; p >= 0; p--) {
      // horizontal offset for this period's group
      const col = (p * (dataSets * 2 + 1)) + 7;

      for (let s = 0; s < dataSets; s++) {
        const val = series[s].rationals[p];
        let mxrow = 1;
        let mnrow = 0;

        if (val.gt(Rational.ZERO)) {
          mxrow = max.minus(val).div(div).round(0n).toNumber() + 1;
          mnrow = zeroRow;
        } else if (val.lt(Rational.ZERO)) {
          mxrow = zeroRow + 1;
          mnrow = zeroRow - val.div(div).round(0n).toNumber();
        }

        const colorFn = this.getColorFunc(s);
        for (let r = mxrow; r <= mnrow; r++) {
          buffer[r][col + s * 2] = colorFn(buffer[r][col + s * 2]);
          buffer[r][col + s * 2 + 1] = colorFn(buffer[r][col + s * 2 + 1]);
        }
      }
    }

    const daysToDraw: string[] = Array(periods.length).fill('');
    const weeksToDraw: string[] = Array(periods.length).fill('');
    const monthsToDraw: string[] = Array(periods.length).fill('');
    const yearsToDraw: string[] = Array(periods.length).fill('');

    let lastMonth = -1;
    let lastYear = -1;
    periods.forEach((period, idx) => {
      if (period.from === undefined) return; // Cannot label without a date
      const d = new Date(period.from);
      const day = d.getUTCDate();

      if (drawDays) {
        daysToDraw[idx] = day.toString().padStart(2, '0');
      }
      if (drawWeeks) {
        weeksToDraw[idx] = this.printWeek(period.from).toString().padStart(2, '0');
      }

      if (day === 1 || (lastMonth !== -1 && lastMonth !== d.getUTCMonth())) {
        drawMonths = true;
        monthsToDraw[idx] = monthInterval > 0 || dayInterval >= 14 ? (d.getUTCMonth() + 1).toString().padStart(2, '0') : this.printFullMonth(d.getUTCMonth());
        lastMonth = d.getUTCMonth();
      }

      if ((d.getUTCMonth() === 0 && day === 1) || (lastYear !== -1 && lastYear !== d.getUTCFullYear())) {
        drawYears = true;
        yearsToDraw[idx] = yearInterval > 0 ? (d.getUTCFullYear() % 100).toString().padStart(2, '0') : d.getUTCFullYear().toString();
        lastYear = d.getUTCFullYear();
      }
    });

    const groupWidth = dataSets * 2 + 1;
    const offsetBase = 7;
    const addLabelRow = (label: string, arr: string[]) => {
      buffer.push(Array(width).fill(' '));
      const rowIdx = buffer.length - 1;
      this.replace(rowIdx, 0, label);
      arr.forEach((txt, idx) => {
        if (!txt) return;
        const col = offsetBase + idx * groupWidth;
        this.replace(rowIdx, col, txt);
      });
    };

    if (drawDays) addLabelRow(' Day', daysToDraw);
    if (drawWeeks) addLabelRow(' Week', weeksToDraw);
    if (drawMonths) addLabelRow('Month', monthsToDraw);
    if (drawYears) addLabelRow(' Year', yearsToDraw);

    buffer.push(Array(width).fill(' '));
    buffer.push(Array(width).fill(' '));
    const legendRow = buffer.length -1;
    let legendCol = offsetBase;
    series.forEach((s, idx) => {
      const colorFn = this.getColorFunc(idx);
      const legendStr = `  ${colorFn('  ')} ${s.name}`;
      this.replace(legendRow, legendCol, legendStr);
      legendCol += legendStr.length + 1;
    });
    buffer.push(Array(width).fill(' '));

    return Ok;
  }

  private numDigits(r: Rational) {
    if (r.isZero()) {
      return 1;
    }
    const absR = Rational.abs(r);
    const intPart = absR.floor();
    return intPart.numerator.toString(10).length;
  }

  private drawYLabel(row: number, num?: Rational) {
    num = num ?? this.max.minus(this.div.times(row));
    const isN = num.lt(Rational.ZERO);
    if (isN)
      num = Rational.abs(num);
    let str = this.formatMetric(num);
    if (isN)
      str = '-' + str;
    this.replace(row, 0, str.padStart(6));
  }

  private formatMetric(num: Rational): string {
    if (num.isZero()) return "0";

    const si: { value: Rational; symbol: string }[] = [
      { value: new Rational(1n, 10n ** 18n), symbol: "a" },
      { value: new Rational(1n, 10n ** 15n), symbol: "f" },
      { value: new Rational(1n, 10n ** 12n), symbol: "p" },
      { value: new Rational(1n, 10n ** 9n), symbol: "n" },
      { value: new Rational(1n, 10n ** 6n), symbol: "μ" },
      { value: new Rational(1n, 10n ** 3n), symbol: "m" },
      { value: Rational.ONE, symbol: "" },
      { value: new Rational(10n ** 3n, 1n), symbol: "k" },
      { value: new Rational(10n ** 6n, 1n), symbol: "M" },
      { value: new Rational(10n ** 9n, 1n), symbol: "G" },
      { value: new Rational(10n ** 12n, 1n), symbol: "T" },
      { value: new Rational(10n ** 15n, 1n), symbol: "P" },
      { value: new Rational(10n ** 18n, 1n), symbol: "E" }
    ]

    const absNum = Rational.abs(num);
    let sel = si[0]
    for (let i = 1; i < si.length; ++i) {
      if (absNum.gte(si[i].value)) sel = si[i];
      else break;
    }

    const scaled = num.div(sel.value)
    const str = scaled.valueOf({ displayPrecision: 2, minFractionDigits: 0, useGrouping: 0 });
    return str + sel.symbol;
  }

  private printFullMonth(m: number) {
    return ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
      ][m];
  }

  private printWeek(ts: timestamp) {
    // ISO‑8601 week number
    const tmp = new Date(toUTCMidnight(ts));
    const day = tmp.getUTCDay() || 7; // Mon = 1, Sun = 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private getColorFunc(idx: number): Ansis {
    const PALETTE = [
      ansis.bgGreen,
      ansis.bgRedBright,
      ansis.bgBlue,
      ansis.bgYellowBright,
      ansis.bgWhiteBright,
      ansis.cyan
    ];

    return PALETTE[idx % PALETTE.length];
  }
}
