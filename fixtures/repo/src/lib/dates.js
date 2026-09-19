const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

export function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

export function isSameDay(a, b) {
  return formatDate(a) === formatDate(b);
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
}

export function monthRange(year, month) {
  const count = daysInMonth(year, month);
  const dates = [];
  for (let day = 1; day <= count; day++) {
    dates.push(new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10));
  }
  return dates;
}
