const { isAuthenticated } = require('../../lib/auth');
const { readCollection, writeCollection } = require('../../lib/store');

function validate(body) {
  const errors = [];
  if (!body.courseCode || !String(body.courseCode).trim()) errors.push('Course code is required.');
  if (!body.title || !String(body.title).trim()) errors.push('Title is required.');
  if (!body.deadline || isNaN(Date.parse(body.deadline))) errors.push('A valid deadline is required.');
  return errors;
}

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });

  const { id } = req.query;
  const works = await readCollection('schoolworks');
  const index = works.findIndex((w) => w.id === id);
  if (index === -1) return res.status(404).json({ error: 'School work not found' });

  if (req.method === 'PUT') {
    const body = req.body || {};
    const errors = validate(body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    works[index] = {
      ...works[index],
      courseCode: String(body.courseCode).trim(),
      title: String(body.title).trim(),
      description: body.description ? String(body.description).trim() : '',
      deadline: new Date(body.deadline).toISOString(),
    };
    await writeCollection('schoolworks', works);
    return res.status(200).json(works[index]);
  }

  if (req.method === 'DELETE') {
    const [removed] = works.splice(index, 1);
    await writeCollection('schoolworks', works);
    return res.status(200).json(removed);
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
