// api/lib/store.js
//
// Reads and writes the JSON "database" files (data/schedule.json,
// data/schoolworks.json).
//
// IMPORTANT — Vercel note:
// Vercel's serverless functions run on a read-only filesystem except
// for /tmp, and /tmp is wiped between cold starts / deployments. That
// means plain file writes work great locally or on a normal always-on
// Node server (a VPS, Render, Railway, etc.), but on Vercel they will
// NOT reliably persist.
//
// To keep things simple, this module still uses JSON files as the
// source of truth. If you deploy the admin write actions on Vercel,
// set KV_REST_API_URL and KV_REST_API_TOKEN (from a free Upstash Redis
// database — Vercel's own "Marketplace Database Storage" tab can
// provision one for you) and this module will automatically use that
// instead, so your data actually persists. Locally, or on a regular
// Node host, no extra setup is needed — it just uses the JSON files.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');

const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

function filePathFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

async function kvGet(name) {
  const url = `${process.env.KV_REST_API_URL}/get/${name}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  const json = await res.json();
  if (!json.result) return null;
  try {
    return JSON.parse(json.result);
  } catch {
    return null;
  }
}

async function kvSet(name, data) {
  const url = `${process.env.KV_REST_API_URL}/set/${name}`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(data),
  });
}

function fileRead(name) {
  const filePath = filePathFor(name);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function fileWrite(name, data) {
  const filePath = filePathFor(name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/** Read a named collection ("schedule" or "schoolworks"). Falls back to [] on the first run. */
async function readCollection(name) {
  if (useKV) {
    const kvData = await kvGet(name);
    if (kvData) return kvData;
    // Seed KV from the bundled JSON file the first time it's used.
    const seed = fileRead(name);
    if (seed.length) await kvSet(name, seed);
    return seed;
  }
  return fileRead(name);
}

/** Overwrite a named collection with a new array. */
async function writeCollection(name, data) {
  if (useKV) {
    await kvSet(name, data);
    return;
  }
  fileWrite(name, data);
}

module.exports = { readCollection, writeCollection, useKV };
