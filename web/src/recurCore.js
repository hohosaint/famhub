// Same logic as server/lib/recur.js (copied; keep the two in step).
const FREQS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const MAX_OCCURRENCES = 366;
const MAX_YEARS = 3;

const ymd = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function clean(rule, start, opts = {}) {
  if (!rule || typeof rule !== 'object' || !FREQS.includes(rule.freq) || rule.freq === 'none') return null;
  const s = parse(start);
  const ints = (a, lo, hi) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n >= lo && n <= hi))].sort((x, y) => x - y);
  const out = { freq: rule.freq, every: Math.max(1, Math.min(99, Math.round(Number(rule.every) || 1))) };
  out.weekdays = ints(rule.weekdays, 0, 6);
  out.monthDays = ints(rule.monthDays, 1, 31);
  out.months = ints(rule.months, 1, 12);
  if (out.freq === 'daily' && !out.weekdays.length) out.weekdays = [0, 1, 2, 3, 4, 5, 6];
  if (out.freq === 'weekly' && !out.weekdays.length) out.weekdays = [s.getUTCDay()];
  if (out.freq === 'monthly' && !out.monthDays.length) out.monthDays = [s.getUTCDate()];
  if (out.freq === 'yearly' && !out.months.length) out.months = [s.getUTCMonth() + 1];
  const limit = ymd(new Date(Date.UTC(s.getUTCFullYear() + MAX_YEARS, s.getUTCMonth(), s.getUTCDate())));
  out.until = /^\d{4}-\d{2}-\d{2}$/.test(rule.until || '') && rule.until >= start ? (rule.until < limit || opts.openEnded ? rule.until : limit) : '';
  if (!out.until && opts.openEnded) out.until = '9999-12-31';   // medicines: until stopped
  if (!out.until) {
    // No end date chosen: three months for daily and weekly, a year for monthly, three years for yearly.
    const d = parse(start);
    if (out.freq === 'daily' || out.freq === 'weekly') d.setUTCMonth(d.getUTCMonth() + 3);
    else if (out.freq === 'monthly') d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + MAX_YEARS);
    out.until = ymd(d);
  }
  return out;
}

// Is this day one of the repeats (start day included)?
function matches(day, start, rule) {
  if (!rule || day < start || day > rule.until) return false;
  const d = parse(day); const s = parse(start);
  const dayDiff = Math.round((d - s) / 86400e3);
  const monthDiff = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + d.getUTCMonth() - s.getUTCMonth();
  switch (rule.freq) {
    case 'daily': return dayDiff % rule.every === 0 && rule.weekdays.includes(d.getUTCDay());
    case 'weekly': {
      const weekStart = (x) => Math.floor((Math.round(x / 86400e3) + 4) / 7); // weeks start on Sunday
      return (weekStart(d) - weekStart(s)) % rule.every === 0 && rule.weekdays.includes(d.getUTCDay());
    }
    case 'monthly': return monthDiff % rule.every === 0 && rule.monthDays.includes(d.getUTCDate());
    case 'yearly': {
      const yearDiff = d.getUTCFullYear() - s.getUTCFullYear();
      const wantDay = Math.min(s.getUTCDate(), daysInMonth(d.getUTCFullYear(), d.getUTCMonth()));
      return yearDiff % rule.every === 0 && rule.months.includes(d.getUTCMonth() + 1) && d.getUTCDate() === wantDay;
    }
    default: return false;
  }
}

// All the days, from the start up to the end date (at most 366).
function expand(start, rule) {
  const out = [];
  for (let day = start; day <= rule.until && out.length < MAX_OCCURRENCES; day = addDays(day, 1)) if (matches(day, start, rule)) out.push(day);
  return out;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function describe(rule) {
  if (!rule) return '';
  const n = rule.every > 1 ? `Every ${rule.every} ` : 'Every ';
  if (rule.freq === 'daily') return rule.weekdays.length === 7 ? (rule.every > 1 ? `Every ${rule.every} days` : 'Every day') : `${n}${rule.every > 1 ? 'days' : 'day'} on ${rule.weekdays.map((d) => DAY_NAMES[d]).join(', ')}`;
  if (rule.freq === 'weekly') return `${n}${rule.every > 1 ? 'weeks' : 'week'} on ${rule.weekdays.map((d) => DAY_NAMES[d]).join(', ')}`;
  if (rule.freq === 'monthly') return `${n}${rule.every > 1 ? 'months' : 'month'} on day ${rule.monthDays.join(', ')}`;
  return `${n}${rule.every > 1 ? 'years' : 'year'} in ${rule.months.map((m) => MONTH_NAMES[m - 1]).join(', ')}`;
}


export { clean, matches, expand, describe, DAY_NAMES, MONTH_NAMES };
