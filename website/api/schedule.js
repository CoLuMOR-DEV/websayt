const crypto = require('crypto');
const { isAuthenticated } = require('./lib/auth');
const { readCollection, writeCollection } = require('./lib/store');

const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(body) {
  const errors = [];
  if (!body.courseCode || !String(body.courseCode).trim()) errors.push('Course code is required.');
  if (!body.courseName || !String(body.courseName).trim()) errors.push('Course name is required.');
  if (!VALID_DAYS.includes(body.day)) errors.push('Day must be one of ' + VALID_DAYS.join(', ') + '.');
  if (!TIME_RE.test(body.startTime || '')) errors.push('Start time must be in 24h HH:MM format.');
  if (!TIME_RE.test(body.endTime || '')) errors.push('End time must be in 24h HH:MM format.');
  if (TIME_RE.test(body.startTime || '') && TIME_RE.test(body.endTime || '') && body.endTime <= body.startTime) {
    errors.push('End time must be after start time.');
  }
  if (body.meetLink && !/^https:\/\//.test(body.meetLink)) {
    errors.push('Google Meet link must start with https://');
  }
  return errors;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const schedule = await readCollection('schedule');
    return res.status(200).json(schedule);
  }

  if (req.method === 'POST') {
    if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });

    const body = req.body || {};
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const schedule = await readCollection('schedule');
    const entry = {
      id: 'sch_' + crypto.randomBytes(6).toString('hex'),
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      courseCode: String(body.courseCode).trim(),
      courseName: String(body.courseName).trim(),
      meetLink: body.meetLink ? String(body.meetLink).trim() : '',
      color: body.color || '#2F6F4E',
    };
    schedule.push(entry);
    await writeCollection('schedule', schedule);
    return res.status(201).json(entry);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
