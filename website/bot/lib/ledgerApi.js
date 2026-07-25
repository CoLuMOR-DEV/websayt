// SITE_URL is read fresh on every call rather than cached once at module
// load. Caching it in a module-level const was a real bug: when the bot
// runs in-process (started from the admin panel via api/lib/botManager.js)
// and "Register slash commands" is clicked before "Start bot", this file
// gets require()'d — and its top-level code run — before botManager has
// had a chance to set process.env.SITE_URL, permanently locking in an
// empty value for the rest of the process's life even after SITE_URL was
// set correctly moments later. Reading it inside each function avoids that.
function siteUrl() {
  return (process.env.SITE_URL || '').replace(/\/$/, '');
}

async function fetchSchedule() {
  const base = siteUrl();
  if (!base) throw new Error('SITE_URL is not set in bot/.env');
  const res = await fetch(`${base}/api/schedule`);
  if (!res.ok) throw new Error(`Schedule request failed (${res.status})`);
  return res.json();
}

async function fetchSchoolworks() {
  const base = siteUrl();
  if (!base) throw new Error('SITE_URL is not set in bot/.env');
  const res = await fetch(`${base}/api/schoolworks`);
  if (!res.ok) throw new Error(`School works request failed (${res.status})`);
  return res.json();
}

function formatTime12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

module.exports = { fetchSchedule, fetchSchoolworks, formatTime12 };
