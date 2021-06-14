/*
 * header:
 *        0  1  2  3  4  5   Total
 * May  1                    HH:MM
 * Wed  2                    00:01
 * ...
 * Thr 20
 *                           _____
 *                           32:11
 */
class Timechart extends Chart {
  constructor(data) {
    super();

    this.width = process.stdout.columns;
    // height is unrestricted as the chart just grows with each day

    // pad(1) + date(6) + pad(1) + 24hr + total(6) + pad(1)
    this.minWidth = 1 + 6 + 1 + 3 * 24 + 6 + 1;
    if (this.width < this.minWidth)
      throw `Minimum terminal width is ${this.minWidth} while only ${this.width} is available.`;

    this.data = data;

    this.minHour = 22;
    this.maxHour = 0;

    this.preprocess();
    // this.paint();
  }

  paint() {
    let hrRange = this.maxHour - this.minHour;
    // width available for drawing timeline, excluding headers & dates
    let timelineWidth = Math.floor((this.width - 1 - 6 - 1 - 6 - 1) / hrRange)
                         * hrRange;
    // columns per hour
    let hrWidth = this.hrWidth = timelineWidth / hrRange;
    // minutes per column
    let colDur = this.colDur = 60 / this.hrWidth;

    let days = this.data;

    for (let i = 0;i < days.length + 3;i++)
      this.buffer.push(Array(this.width).fill(' '));

    // ###### render header ######
    this.replace(1, 8 + hrRange * hrWidth, ' Total');

    for (let i = 0;i < hrRange;i++) {
      let hour = i + this.minHour;
      // use replace because hours could have two digits
      this.replace(1, 8 + i * hrWidth, hour.toString());
    }

    // ###### render rows ######
    for (let i = 0;i < days.length;i++) {
      let day = days[i];
      let row = i + 2;

      // ============== date =============
      let wday = day.date.getDay();
      // sunday
      if (wday == 0)
        this.buffer[row].underline = true;

      this.replace(row, 5, day.date.getDate().toString().padStart(2, ' '));

      if (day.date.getDate() == 1) {
        this.replace(row, 1, print_monthNames[day.date.getMonth()].substring(0, 3));
        this.buffer[row][1] = ESC + "[1m" + this.buffer[row][1];
        this.buffer[row][7] = ESC + "[0m ";
      } else {
        this.replace(row, 1, print_weekdayNames[wday].substring(0, 3));
      }

      // ============= entries =============
      for (let entry of day) {
        let dj = 0;
        for (let j = 0;j < timelineWidth;j++) {
          let start = day.date / 1000 +
                      this.minHour * 60 * 60 +
                      j * colDur * 60;
          let col = 8 + j;
          if (start >= entry.from && start < entry.to) {
            // http://www.w3.org/TR/AERT#color-contrast
            let brightness = Math.round((
                             (parseInt(entry.rgb[0]) * 299) +
                             (parseInt(entry.rgb[1]) * 587) +
                             (parseInt(entry.rgb[2]) * 114)) / 1000)

            this.buffer[row][col] = ESC + '[38;2;' +
                                    `${brightness > 125 ?
                                         '0;0;0' :
                                         '255;255;255'}m` +
                                    ESC + '[48;2;' +
                                    `${entry.rgb.join(";")}m` +
                                    (this.buffer[row].underline ?
                                      ESC + '[4m' : '') +
                                    (entry.desc[dj++] || ' ') +
                                    ESC + '[39m' + ESC + '[49m' +
                                    (this.buffer[row].underline ?
                                      ESC + '[4m' : '');
          }
        }
      }

      // ============== total ==============
      this.replace(row, timelineWidth + 8 + 1, Timechart._hms_f(day.total));
    }

    this.replace(days.length + 2, timelineWidth + 8 + 1 - 7,
                 'Total: ' + Timechart._hms_f(days.total));

    delete this._simple;
  }

  static _hms_f(time) {
    let [hours, minutes] = Timechart._hms(time);
    return hours.toString().padStart(2, ' ') + ':' +
           minutes.toString().padStart(2, '0');
  }

  static _hms(time) {
    let hr;
    return [hr = Math.floor(time / 60 / 60),
            Math.floor((time - hr * 60 * 60) / 60)];
  }

  /*
   * Headers:
   * Date       Day Desc Start(R)   End(R) Time(R) Total
   * 2016-08-07 Mon ...      8:01    10:02    2:01
   *                ...      8:01    10:02    2:01  4:02
   *                                         Total: 4:02
   */
  simple() {
    let days = this.data;

    let table = [["Date", "Day", "Desc", "Start", "End", "Time", "Total"]];
    let align = [TAB_ALIGN_LEFT, TAB_ALIGN_LEFT, TAB_ALIGN_LEFT,
                 TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT, TAB_ALIGN_RIGHT,
                 TAB_ALIGN_RIGHT];

    let rowIndex = 0;
    for (let i = 0;i < days.length;i++) {
      let day = days[i];
      let wday = day.date.getDay();
      let nextWeek = wday == 0 ?
                       // if sunday, tomorrow is a new week
                       new Date(day.date.getTime() + 24 * 60 * 60 * 1000) :
                       wday == 1 ?
                         // if monday, next week
                         new Date(day.date.getTime() + 7 * 24 * 60 * 60 * 1000) :
                         new Date(day.date.getTime() +
                           (((7 - wday) % 7 + 1) % 7) * 24 * 60 * 60 * 1000);

      rowIndex += day.length ? 1 : 0;

      let j = 0;
      for (let entry of day) {
        let row = ['', ''];

        if (j == 0 || cli_args.flags.csv) {
          // ============== date =============
          row[0] = entry_datestr(day.date / 1000);
          row[1] = day.date.getDate() == 1 ?
                     c.bold(print_monthNames[day.date.getMonth()].substring(0, 3)) :
                     print_weekdayNames[wday].substring(0, 3);
        }

        let nextNonEmptyDay;
        let h = 0;
        while (days[i + ++h]) {
          if (days[i + h].length) {
            nextNonEmptyDay = days[i + h];
            break;
          }
        }

        if (j == day.length - 1 && nextNonEmptyDay &&
            nextNonEmptyDay.date >= nextWeek)
          row.underline = true;

        row[2] = entry.desc;
        row[3] = entry_timestr(entry.from).split(" ")[1].replace(/^0/, '')
                                          .split(":").slice(0, 2).join(":");
        row[4] = entry_timestr(entry.to).split(" ")[1].replace(/^0/, '')
                                          .split(":").slice(0, 2).join(":");
        row[5] = Timechart._hms_f(entry.to - entry.from);
        row[6] = j == day.length - 1 ? Timechart._hms_f(day.total) : '';

        row.rowIndex = rowIndex;
        table.push(row);
        j++;
      }

    }
    let row = Array(7).fill('');
    row.rowIndex = 0;
    table.push(row);
    row = ['', '', '', '', '', 'Total', Timechart._hms_f(days.total)];
    row.rowIndex = 0;
    table.push(row);

    this._simple = tabulate(table, { align: align, alternateColor: 2 });
  }

  render() {
    return this._simple || super.render();
  }

  preprocess() {
    let days = this.data;
    this.data.total = 0;

    for (let i = 0;i < days.length;i++) {
      let day = days[i];
      let dfrom = Math.floor(day.date.getTime() / 1000);
      // total time in seconds
      day.total = 0;

      for (let entry of day) {
        // limits clockIn to the start of the day
        entry.from = Math.max(entry.from, dfrom);

        let dur = entry.to - entry.from;

        this.minHour = Math.min(this.minHour, new Date(entry.from * 1000).getHours());
        this.maxHour = Math.max(this.maxHour, new Date(entry.to * 1000 - 1).getHours() + 1);

        day.total += dur;
      }

      days.total += day.total;
      days[i] = day = day.sort((a, b) => a.from - b.from);
    }
  }
}
