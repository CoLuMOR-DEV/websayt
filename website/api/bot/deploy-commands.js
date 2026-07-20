const { isAuthenticated } = require('../lib/auth');
const botManager = require('../lib/botManager');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const result = await botManager.deployCommands();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
