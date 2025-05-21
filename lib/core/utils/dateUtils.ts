import Sugar from "../../../external/sugar.js";
import { Result, timestamp } from "../types.ts";

export class SmartDateParseError extends Error {
  private readonly __smartDateParseErrorBrand = undefined;
}

export function parseSmartDate(date: string): Result<timestamp> {
  // if (/^[\d]{4}$/.exec(date)) {
  //   date += '-01-01 00:00:00';
  // }

  // const isoResult = Date.parse(date + 'Z');

  // if (!Number.isNaN(isoResult)) {
  //   return isoResult;
  // }

  const result = Sugar.Date.create(date).getTime();

  if (isNaN(result)) {
    return new SmartDateParseError(`"${date}" cannot be parsed as a smart date.`);
  }

  return relabelLocalDateAsUtc(new Date(result));
}

const pad = (n: number, width = 2) => n.toString().padStart(width, '0');

export function relabelLocalDateAsUtc(date: Date): timestamp {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

  // We use this bc the year argument in Date.UTC is funky
  const utcIso = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;

  return Date.parse(utcIso);
}

export function isUtcMidnight(ts: timestamp | Date): boolean {
  const date = ts instanceof Date ? ts : new Date(ts);
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

export function getUTCTodayMidnight(): timestamp {
  return toUTCMidnight(relabelLocalDateAsUtc(new Date()));
}

export function toUTCMidnight(ts: timestamp | Date): timestamp {
  const date = ts instanceof Date ? ts : new Date(ts);

  return Date.parse(toUTCDateString(date) + ' 00:00:00Z');
}

export function toUTCDateString(ts: timestamp | Date) {
  const date = ts instanceof Date ? ts : new Date(ts);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function toUTCTimeString(ts: timestamp | Date) {
  const date = ts instanceof Date ? ts : new Date(ts);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export function toUTCDatetimeString(ts: timestamp | Date) {
  const date = ts instanceof Date ? ts : new Date(ts);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export type DateSquashFlag = "y" | "m" | "w" | "d" | "h";

export type DateSquashFlags = `${DateSquashFlag}${DateSquashFlag | ""}${DateSquashFlag | ""}${DateSquashFlag | ""}`

/**
 * Calculates calendar difference between two dates.
 *
 * @param ts1
 * @param ts2
 */
export function differenceBetweenDates(
  ts1: timestamp | Date,
  ts2: timestamp | Date,
  squash: DateSquashFlags = "ymd",
): Record<DateSquashFlag, number> {
  const d1 = ts1 instanceof Date ? ts1 : new Date(ts1);
  const d2 = ts2 instanceof Date ? ts2 : new Date(ts2);

  ts1 = d1.getTime();
  ts2 = d2.getTime();

  let y = d1.getUTCFullYear() - d2.getUTCFullYear();
  let m = d1.getUTCMonth() - d2.getUTCMonth();
  let d = d1.getUTCDate() - d2.getUTCDate();

  if (d < 0) {
    // borrow one month
    const daysLastMonth = new Date(d1.getUTCFullYear(), d1.getUTCMonth(), 0).getUTCDate();

    d += (daysLastMonth < d2.getUTCDate() ? d2.getUTCDate() : daysLastMonth);

    m--;
  }
  if (m < 0) {
    m = 12 + m;
    y--;
  }

  // yd -> take out year, rest in days
  // md -> year to day
  if (!squash.includes('y')) {
    if (squash.includes('m')) { // md
      m += y * 12;
    } else { // d
      d = Math.floor((ts1 - ts2) / (24 * 60 * 60 * 1000));
    }
  } else if (!squash.includes('m')) { // yd
    const _d2 = new Date(d2);
    _d2.setUTCFullYear(_d2.getUTCFullYear() + y);

    d = Math.floor((ts1 - _d2.getTime()) / (24 * 60 * 60 * 1000));
  }

  // take off days to weeks
  let w = 0;
  if (squash.includes("w")) {
    w = Math.floor(d / 7);
    d = d % 7;
  }

  // leftover hours
  let h = 0;
  if (squash.includes("h")) {
    // rebuild a base date by adding back the calendar units we've kept
    const base = new Date(d2.getTime());
    if (squash.includes("y")) base.setUTCFullYear(base.getUTCFullYear() + y);
    if (squash.includes("m")) base.setUTCMonth(base.getUTCMonth() + m);
    if (squash.includes("w")) base.setUTCDate(base.getUTCDate() + w * 7);
    if (squash.includes("d")) base.setUTCDate(base.getUTCDate() + d);

    h = Math.floor((ts1 - base.getTime()) / (60 * 60 * 1000));
  }


  return {
    y, m, w, d, h
  };
}