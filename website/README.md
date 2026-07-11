# BSCS-DS 3A Sched

A class schedule board (tap a period → join the Google Meet), a School
Works page for assignments and deadlines, a password-protected admin
panel to manage both — and a Discord bot that lives *inside* the admin
panel instead of being a separate thing you have to babysit.

Plain HTML/CSS/JS on the front end. A single always-on Node/Express
server on the back end (`server.js`) — no Vercel CLI required to run
this locally. It still ships `vercel.json` and the `api/*.js` files in
Vercel's serverless-function shape, so it *can* also be deployed to
Vercel if you want (see the note on the bot at the bottom — this only
affects that one feature).

```
website/
├─ index.html             Schedule page (public)
├─ schoolworks.html        School Works page (public)
├─ css/, js/               Shared styles/scripts (incl. cyber-bg.js, the
│                          animated background)
├─ admin/                  Admin panel — reachable only at /admin,
│                          not linked from any public page
│  ├─ index.html
│  ├─ css/admin.css
│  └─ js/admin.js
├─ api/                    Route handlers (Vercel-function shaped, but
│  │                       run directly by server.js locally)
│  ├─ login.js / logout.js / session.js
│  ├─ schedule.js, schedule/[id].js
│  ├─ schoolworks.js, schoolworks/[id].js
│  ├─ bot/                 Discord bot config + start/stop/status
│  └─ lib/
│     ├─ auth.js           Password check + signed session cookies
│     ├─ store.js          JSON file storage (optional Upstash fallback)
│     ├─ botConfig.js      Reads/writes data/bot-config.json
│     └─ botManager.js     Starts/stops the bot in-process
├─ data/
│  ├─ schedule.json, schoolworks.json
│  └─ bot-config.json      Created on first save; gitignored (has the token)
├─ bot/                    The bot's slash commands, reused by botManager.js
├─ scripts/hash-password.js
└─ server.js               Local/always-on server — run this with `npm start`
```

## 1. Run it locally

```bash
npm install
cp .env.example .env
```

Open `.env` and set a password:

```
ADMIN_PASSWORD=choose-anything-you-want
```

Then:

```bash
npm start
```

- Site: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin` — **this is intentionally
  not linked anywhere on the public pages.** You have to type it in.

That's it — no Vercel CLI, no separate bot process to start by hand.

## 2. How the login works

- The password lives only in `.env` (`ADMIN_PASSWORD`), read on the
  server. It's never sent to the browser or written into any HTML/CSS/JS.
- Logging in sets a signed, `httpOnly` session cookie, so client-side
  JavaScript (or poking around in DevTools) can't read it, and it can't
  be forged.
- Every write (`POST`/`PUT`/`DELETE` on `/api/schedule`,
  `/api/schoolworks`, and `/api/bot/*`) re-checks that cookie on the
  server — the admin page is just a UI in front of that check.
- If you'd rather not keep a plaintext password in `.env`, run
  `npm run hash-password -- "your-password"` and put the printed
  `ADMIN_PASSWORD_SALT`/`ADMIN_PASSWORD_HASH` in `.env` instead (leave
  `ADMIN_PASSWORD` blank in that case).

## 3. The Discord bot (Admin → Discord Bot tab)

Unlike a typical setup where the bot is a separate process you run and
babysit yourself, this bot runs *inside* the same server process and is
fully controlled from the admin panel:

1. Create an application at the
   [Discord Developer Portal](https://discord.com/developers/applications),
   add a bot to it, and copy its **token** and the application's
   **Client ID**.
2. In the admin panel's **Discord Bot** tab, paste the token and Client
   ID, optionally a test-server **Guild ID** (makes slash commands sync
   instantly instead of up to an hour later), and the **channel ID**
   you want announcements posted to. Save.
3. Click **Register slash commands** once, then **Start bot**.

Two schedule-aware features you can toggle right there:
- **Daily schedule post** — posts today's periods to the announcement
  channel at an hour you choose.
- **Deadline reminders** — posts a reminder when a School Works
  deadline is within a chosen number of hours.

Plus the always-available slash commands:
- `/schedule [day]` — that day's classes, with Join buttons for any
  linked Meets.
- `/schoolworks [course]` — the next 10 upcoming deadlines, optionally
  filtered by course code.

**Important if you ever deploy this to Vercel instead of running it
locally:** a Discord bot holds one persistent WebSocket connection
open, which doesn't fit a serverless function's model. The in-panel
bot only works while this is running as one continuous process (local,
a VPS, Railway, Fly.io, etc.) — not on Vercel serverless.

## 4. Deploying somewhere other than your own machine

Any always-on Node host (a VPS, Railway, Render, a Raspberry Pi…) just
needs `npm install && npm start` with the same `.env`. If you deploy to
Vercel specifically, note two things: the bot won't run there (above),
and Vercel's serverless functions have a **read-only filesystem**
except `/tmp` — so admin edits to the JSON files won't reliably persist
unless you also set `KV_REST_API_URL`/`KV_REST_API_TOKEN` (a free
Upstash Redis database via Vercel's Storage tab). Not needed for local
use.

## 5. Design notes

Dark "cybersigilism" theme — near-black background, glowing cyan/violet
linework, a `js/cyber-bg.js` canvas quietly rotating geometric sigils
and drifting circuit nodes behind everything (it turns static if the
browser prefers reduced motion). The schedule grid switches to a
day-tabs + agenda list on narrow screens instead of a horizontally
scrolling table.
