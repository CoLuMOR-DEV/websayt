const { isAuthenticated } = require('../../lib/auth');
const botManager = require('../../lib/botManager');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json(botManager.getStatus());
};
