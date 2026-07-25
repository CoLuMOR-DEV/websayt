const crypto = require('crypto');
const { isAuthenticated } = require('./lib/auth');
const { readCollection, writeCollection } = require('./lib/store');

function validate(body) {
  const errors = [];
  if (!body.courseCode || !String(body.courseCode).trim()) errors.push('Course code is required.');
  if (!body.title || !String(body.title).trim()) errors.push('Title is required.');
  if (!body.deadline || isNaN(Date.parse(body.deadline))) errors.push('A valid deadline is required.');
  return errors;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const works = await readCollection('schoolworks');
    works.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    return res.status(200).json(works);
  }

  if (req.method === 'POST') {
    if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });

    const body = req.body || {};
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const works = await readCollection('schoolworks');
    const entry = {
      id: 'wrk_' + crypto.randomBytes(6).toString('hex'),
      courseCode: String(body.courseCode).trim(),
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : '',
      deadline: new Date(body.deadline).toISOString(),
      postedAt: new Date().toISOString(),
    };
    works.push(entry);
    await writeCollection('schoolworks', works);

    // Fire-and-forget: don't make the admin wait on Discord round-trips,
    // and never fail the save because the bot isn't running/configured.
    require('./lib/botManager').announceNewSchoolwork(entry).catch(() => {});

    return res.status(201).json(entry);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
