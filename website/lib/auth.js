// api/lib/auth.js
//
// Minimal, dependency-free session auth for the admin panel.
//
// The admin password is NEVER stored or shipped in client-side code.
// Two ways to configure it, checked in this order:
//
//   1. ADMIN_PASSWORD (plain string in .env) — the easy path for running
//      this locally. It never leaves the server process.
//   2. ADMIN_PASSWORD_HASH / ADMIN_PASSWORD_SALT (scrypt hash, generated
//      by scripts/hash-password.js) — the harder-to-reverse path,
//      recommended if this is ever deployed somewhere reachable from the
//      internet.
//
// Sessions are a small signed token (HMAC-SHA256), stored in an
// httpOnly, Secure, SameSite=Strict cookie. Because it's httpOnly,
// no client-side JavaScript (or "view source") can ever read it,
// and because it's signed, it can't be forged without SESSION_SECRET.

const crypto = require('crypto');

const COOKIE_NAME = 'sw_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

/** Hash a plaintext password with a salt using scrypt (Node built-in, no deps). */
function hashPassword(password, salt) {
  const derived = crypto.scryptSync(password, salt, 64);
  return derived.toString('hex');
}

function timingSafeStringsEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal length so failed attempts on a
    // wrong-length guess take the same time as a right-length one.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verify a submitted password against whichever method is configured. */
function verifyPassword(password) {
  if (process.env.ADMIN_PASSWORD) {
    return timingSafeStringsEqual(password, process.env.ADMIN_PASSWORD);
  }

  const salt = requireEnv('ADMIN_PASSWORD_SALT');
  const expectedHash = requireEnv('ADMIN_PASSWORD_HASH');
  const actualHash = hashPassword(password, salt);

  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}

// On Vercel, every request can land on a *different* serverless function
// instance/cold start. A random per-process fallback secret would mean the
// instance that handles /api/login signs the cookie with secret A, and the
// very next request (checking the session, or saving a schedule/work item)
// can land on a different instance using secret B — the signature check
// fails, and the admin panel silently bounces back to the login screen
// even though the password was correct. So on Vercel, SESSION_SECRET is
// mandatory: fail loudly and clearly instead of appearing to "not work."
//
// On a plain Node host (server.js — a VPS, Render, Railway, etc.) there is
// only ever one long-lived process, so a random fallback generated once at
// boot is safe and sessions behave correctly (they just won't survive a
// restart, which is fine for local dev).
let ephemeralSecret = null;
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  const onVercel = !!process.env.VERCEL;
  if (onVercel) {
    throw new Error(
      'SESSION_SECRET is not set. On Vercel this is required — without it, ' +
      'each serverless instance signs sessions with a different random ' +
      'secret, so logins appear to silently fail or randomly log you out. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
      'and add it as SESSION_SECRET in your Vercel project\'s Environment Variables, then redeploy.'
    );
  }

  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      'SESSION_SECRET is not set — using a temporary secret for this run only.\n' +
      'Set SESSION_SECRET in .env to keep sessions valid across restarts.'
    );
  }
  return ephemeralSecret;
}

function sign(data) {
  return crypto.createHmac('sha256', sessionSecret()).update(data).digest('hex');
}

/** Create a signed session token for a successful login. */
function createSessionToken() {
  const payload = JSON.stringify({
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  const encoded = base64url(payload);
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

/** Verify a session token. Returns the decoded payload, or null if invalid/expired. */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expectedSignature = sign(encoded);

  const a = Buffer.from(signature || '', 'hex');
  const b = Buffer.from(expectedSignature, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

/** Reads the session cookie from a request and tells you if it's a valid admin session. */
function isAuthenticated(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  try {
    const payload = verifySessionToken(token);
    return !!payload && payload.role === 'admin';
  } catch (err) {
    // Fail closed (treat as logged out) rather than crashing the request —
    // but still surface the misconfiguration in the server logs so it's
    // easy to spot (e.g. missing SESSION_SECRET on Vercel).
    console.error('Session check failed:', err.message);
    return false;
  }
}

function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  isAuthenticated,
  setSessionCookie,
  clearSessionCookie,
};
