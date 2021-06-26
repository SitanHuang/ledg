function events_date_prec_diff(d1, d2, squash='ymd') {
  let y = d1.getFullYear() - d2.getFullYear();
  let m = d1.getMonth() - d2.getMonth();
  let d = d1.getDate() - d2.getDate();

  if (d < 0) {
    let daysLastMonth = new Date(d1.getFullYear(), d1.getMonth(), 0).getDate();
    if (daysLastMonth < d2.getDate())
      d += d2.getDate();
    else
      d = daysLastMonth + d;
    m--;
  }
  if (m < 0) {
    m = 12 + m;
    y--;
  }

  // yd -> take out year, rest in days
  // md -> year to day
  if (squash.indexOf('y') == -1) {
    if (squash.indexOf('m') >= 0) // md
      m += y * 12;
    else // d
      d = Math.floor((d1 - d2) / (24 * 60 * 60 * 1000));
  } else if (squash.indexOf('m') == -1) { // yd
    let _d2 = new Date(d2);
    _d2.setFullYear(_d2.getFullYear() + y);
    d = Math.floor((d1 - _d2) / (24 * 60 * 60 * 1000));
  }

  return [y, m, d];
}
