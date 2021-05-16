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
    this.paint();
  }

  paint() {
    let hrRange = this.maxHour - this.minHour;
    // width available for drawing timeline, excluding headers & dates
    let timelineWidth = this.width - 1 - 6 - 1 - 6 - 1;
    // columns per hour
    let hrWidth = this.hrWidth = Math.floor(timelineWidth / hrRange);
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
            this.buffer[row][col] = ESC + '[38;2;255;255;255;m' +
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
      let hours = Math.floor(day.total / 60 / 60);
      let minutes = Math.floor((day.total - hours * 60 * 60) / 60);
      this.replace(row, timelineWidth + 7 + 1,
                   hours.toString().padStart(2, '0') + ':' +
                   minutes.toString().padStart(2, '0'));
    }
    let hours = Math.floor(days.total / 60 / 60);
    let minutes = Math.floor((days.total - hours * 60 * 60) / 60);
    this.replace(days.length + 2, timelineWidth + 7 + 1 - 7,
                 'Total: ' +
                 hours.toString().padStart(2, '0') + ':' +
                 minutes.toString().padStart(2, '0'));
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
        this.maxHour = Math.max(this.maxHour, new Date(entry.to * 1000).getHours());

        day.total += dur;
      }

      days.total += day.total;
      days[i] = day = day.sort((a, b) => a.from - b.from);
    }
  }
}
