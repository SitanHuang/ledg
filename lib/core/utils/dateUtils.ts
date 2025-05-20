import * as chrono from 'chrono-node';
import { Result, timestamp } from "../types.ts";

export class SmartDateParseError extends Error {
  private readonly __smartDateParseErrorBrand = undefined;
}

export function parseSmartDate(date: string): Result<timestamp> {
  if (/^[\d]{4}$/.exec(date)) {
    date += '-01-01 00:00:00';
  }

  const isoResult = Date.parse(date + 'Z');

  if (!Number.isNaN(isoResult)) {
    return isoResult;
  }

  const result = chrono.parseDate(date);

  if (!result) {
    return new SmartDateParseError(`"${date}" cannot be parsed as a smart date.`);
  }

  return relabelLocalDateAsUtc(result);
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