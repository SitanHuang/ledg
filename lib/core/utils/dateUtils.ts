import * as chrono from 'chrono-node';
import { Result, timestamp } from "../types.ts";

export class SmartDateParseError extends Error {
  private readonly __smartDateParseErrorBrand = undefined;
}

export function parseSmartDate(date: string): Result<timestamp> {
  if (/^[\d]{4}$/.exec(date)) {
    date += '/1/1';
  }

  const result = chrono.parseDate(date);

  if (!result) {
    return new SmartDateParseError(`"${date}" cannot be parsed as a smart date.`);
  }

  return relabelLocalDateAsUtc(result);
}

export function relabelLocalDateAsUtc(date: Date): timestamp {
  const pad = (n: number, width = 2) => n.toString().padStart(width, '0');

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

export function isUtcMidnight(ts: timestamp): boolean {
  const date = new Date(ts);
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}