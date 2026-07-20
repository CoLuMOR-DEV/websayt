const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');

async function fetchSchedule() {
  if (!SITE_URL) throw new Error('SITE_URL is not set in bot/.env');
  const res = await fetch(`${SITE_URL}/api/schedule`);
  if (!res.ok) throw new Error(`Schedule request failed (${res.status})`);
  return res.json();
}

async function fetchSchoolworks() {
  if (!SITE_URL) throw new Error('SITE_URL is not set in bot/.env');
  const res = await fetch(`${SITE_URL}/api/schoolworks`);
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
