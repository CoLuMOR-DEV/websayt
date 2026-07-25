// api/lib/manilaTime.js
//
// The site's schedule is for a class in the Philippines, but the server
// itself might run anywhere (Railway, Vercel, etc. default to UTC). All
// bot scheduling ("is it 7 AM yet", "what day is it", "has this class
// started") needs to be evaluated in Asia/Manila (UTC+8, no DST) rather
// than the host machine's local time — otherwise a server running in UTC
// posts the daily schedule at 3 PM Manila time instead of 7 AM, and on
// the wrong day around midnight.
//
// Uses Intl.DateTimeFormat (built into Node, no dependency) rather than a
// fixed UTC+8 offset — same result for this timezone (it has no DST) but
// correct even if Node's ICU data changes.

const TIME_ZONE = 'Asia/Manila';
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The current moment, broken down in Asia/Manila. */
function manilaNow(date = new Date()) {
  const parts = {};
  for (const p of formatter.formatToParts(date)) parts[p.type] = p.value;
  const weekdayShort = parts.weekday.slice(0, 3).toUpperCase();
  return {
    dayCode: DAYS.includes(weekdayShort) ? weekdayShort : weekdayShort, // MON..SUN
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`, // for "already posted today" checks
  };
}

/** Format a Date/ISO string as a human-readable Manila-time string. */
function formatManila(dateOrIso, opts = {}) {
  const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return date.toLocaleString('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    ...opts,
  });
}

module.exports = { TIME_ZONE, DAYS, manilaNow, formatManila };
