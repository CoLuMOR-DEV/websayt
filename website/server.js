// server.js
//
// A plain, always-on Node/Express server for local development (and for
// hosting this anywhere that isn't Vercel — a VPS, Railway, Render, etc).
//
// It serves the static site, reuses the exact same api/*.js handlers that
// Vercel would call as serverless functions (so nothing under api/ had to
// be rewritten), and — unlike Vercel's serverless model — stays alive as
// one persistent process. That persistence is what lets the Discord bot
// live inside the admin panel: it needs a long-lived WebSocket connection,
// which a serverless function can't hold open.
//
// Run it with: npm start   (defaults to http://localhost:3000)

require('dotenv').config();

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------------------------------------------------------------------
// Wrap a Vercel-style handler ( module.exports = async (req, res) => {} )
// so it works unmodified under Express, including the dynamic [id] routes.
// ---------------------------------------------------------------------
function wrap(handler) {
  return async (req, res) => {
    if (req.params && req.params.id !== undefined) {
      req.query = { ...req.query, id: req.params.id };
    }
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: 'Server error' });
    }
  };
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
app.post('/api/login', wrap(require('./api/login')));
app.post('/api/logout', wrap(require('./api/logout')));
app.get('/api/session', wrap(require('./api/session')));

// ---------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------
app.get('/api/schedule', wrap(require('./api/schedule')));
app.post('/api/schedule', wrap(require('./api/schedule')));
app.put('/api/schedule/:id', wrap(require('./api/schedule/[id]')));
app.delete('/api/schedule/:id', wrap(require('./api/schedule/[id]')));

// ---------------------------------------------------------------------
// School works
// ---------------------------------------------------------------------
app.get('/api/schoolworks', wrap(require('./api/schoolworks')));
app.post('/api/schoolworks', wrap(require('./api/schoolworks')));
app.put('/api/schoolworks/:id', wrap(require('./api/schoolworks/[id]')));
app.delete('/api/schoolworks/:id', wrap(require('./api/schoolworks/[id]')));

// ---------------------------------------------------------------------
// Discord bot (admin-only, in-process — see api/lib/botManager.js)
// ---------------------------------------------------------------------
app.get('/api/bot/config', wrap(require('./api/bot/config')));
app.post('/api/bot/config', wrap(require('./api/bot/config')));
app.get('/api/bot/status', wrap(require('./api/bot/status')));
app.post('/api/bot/start', wrap(require('./api/bot/start')));
app.post('/api/bot/stop', wrap(require('./api/bot/stop')));
app.post('/api/bot/deploy-commands', wrap(require('./api/bot/deploy-commands')));

// ---------------------------------------------------------------------
// Static site
// ---------------------------------------------------------------------
// /admin (no trailing file) resolves to the admin panel. It is never
// linked from the public pages — it only exists for whoever types it in.
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.use(express.static(__dirname, { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\nBSCS-DS 3A Sched running at http://localhost:${PORT}`);
  console.log(`Admin panel:              http://localhost:${PORT}/admin\n`);

  if (!process.env.ADMIN_PASSWORD && !(process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_SALT)) {
    console.log(
      'No admin password is configured yet. Set ADMIN_PASSWORD in your .env\n' +
      'file (simplest for local use), or run `npm run hash-password -- "your-password"`\n' +
      'for the salted-hash version. See .env.example.\n'
    );
  }

  // If a Discord bot config was already saved from a previous run and it
  // was left running, bring it back up automatically.
  require('./lib/botManager').autoStartIfConfigured();
});
