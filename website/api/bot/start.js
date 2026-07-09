const { isAuthenticated } = require('../../lib/auth');
const botManager = require('../../lib/botManager');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const status = await botManager.start();
  return res.status(200).json(status);
};
