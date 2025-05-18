import { isUtcMidnight } from "../utils/dateUtils.ts";
import { timestamp } from "../types.ts";

export class DateFormat {
  locale: Intl.LocalesArgument = new Intl.NumberFormat().resolvedOptions().locale;

  dateFormat = "YYYY-MM-DD";
  datetimeFormat = "YYYY-MM-DD HH:mm:ss";

  positiveInf = "∞";
  negativeInf = "-∞";

  static utc(): DateFormat {
    const format = new DateFormat();
    format.locale = 'UTC';
    format.dateFormat = "YYYY-MM-DD";
    format.datetimeFormat = "YYYY-MM-DD HH:mm:ss";
    return format;
  }

  formatDate(timestamp: timestamp) {
    const format = isUtcMidnight(timestamp) ? this.dateFormat : this.datetimeFormat;
    const locale = this.locale;

    if (timestamp === Infinity) {
      return this.positiveInf;
    }
    if (timestamp === -Infinity) {
      return this.negativeInf;
    }

    const date = new Date(timestamp);
    const tokenRegex = /(YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|dd|d|DD|D|HH|H|hh|h|mm|m|ss|s|SSS|A|a)|([^YMDdHhmsSAa]+)/gy;
    const parts = [];
    let match;

    while ((match = tokenRegex.exec(format)) !== null) {
      if (match[1]) {
        const token = match[1];
        let part;
        switch (token) {
          case 'YY':
            part = new Intl.DateTimeFormat(locale, { year: '2-digit', timeZone: 'UTC' }).format(date);
            break;
          case 'YYYY':
            part = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: 'UTC' }).format(date);
            break;
          case 'M':
            part = new Intl.DateTimeFormat(locale, { month: 'numeric', timeZone: 'UTC' }).format(date);
            break;
          case 'MM':
            part = new Intl.DateTimeFormat(locale, { month: '2-digit', timeZone: 'UTC' }).format(date);
            break;
          case 'MMM':
            part = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(date);
            break;
          case 'MMMM':
            part = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(date);
            break;
          case 'D':
            part = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }).format(date);
            break;
          case 'DD':
            part = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'UTC' }).format(date);
            break;
          case 'd':
            part = date.getUTCDay().toString();
            break;
          case 'dd': {
            const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
            const day = formatter.format(date);
            part = day.slice(0, 2);
            break;
          }
          case 'ddd':
            part = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
            break;
          case 'dddd':
            part = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(date);
            break;
          case 'H':
            part = date.getUTCHours().toString();
            break;
          case 'HH':
            part = date.getUTCHours().toString().padStart(2, '0');
            break;
          case 'h': {
            const h12 = date.getUTCHours() % 12 || 12;
            part = h12.toString();
            break;
          }
          case 'hh': {
            const h12 = date.getUTCHours() % 12 || 12;
            part = h12.toString().padStart(2, '0');
            break;
          }
          case 'm':
            part = date.getUTCMinutes().toString();
            break;
          case 'mm':
            part = date.getUTCMinutes().toString().padStart(2, '0');
            break;
          case 's':
            part = date.getUTCSeconds().toString();
            break;
          case 'ss':
            part = date.getUTCSeconds().toString().padStart(2, '0');
            break;
          case 'SSS': {
            const ms = date.getUTCMilliseconds();
            part = ms.toString().padStart(3, '0');
            break;
          }
          case 'A': {
            const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
            const parts = formatter.formatToParts(date);
            const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value ?? '';
            part = dayPeriod.toUpperCase();
            break;
          }
          case 'a': {
            const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
            const parts = formatter.formatToParts(date);
            const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value ?? '';
            part = dayPeriod.toLowerCase();
            break;
          }
          default:
            part = '';
            break;
        }
        parts.push(part);
      } else if (match[2]) {
        parts.push(match[2]);
      }
    }

    return parts.join('');
  }

  copy(): DateFormat {
    return Object.assign(new DateFormat(), this);
  }
}