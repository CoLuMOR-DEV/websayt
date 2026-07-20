// POST /api/login  { password: string }
// Verifies the password against the server-side hash and, on success,
// sets an httpOnly session cookie. The password itself is never
// echoed back, logged, or stored client-side.

const { verifyPassword, createSessionToken, setSessionCookie } = require('./lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  let ok = false;
  try {
    ok = verifyPassword(password);
  } catch (err) {
    console.error('Auth configuration error:', err.message);
    return res.status(500).json({ error: 'Server auth is not configured. See .env.example.' });
  }

  if (!ok) {
    // Same generic message regardless of whether the password format
    // was "close" — don't leak anything that helps guessing.
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = createSessionToken();
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true });
};
