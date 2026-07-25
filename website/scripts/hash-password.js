#!/usr/bin/env node
// Generates a random salt + scrypt hash for your chosen admin password.
// Run: node scripts/hash-password.js "your-password-here"
// Then copy the two printed lines into your .env file (and into your
// Vercel project's Environment Variables). Never commit the real .env.

const crypto = require('crypto');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password-here"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');

console.log('\nAdd these to your .env (and to Vercel → Project → Settings → Environment Variables):\n');
console.log(`ADMIN_PASSWORD_SALT=${salt}`);
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log('\nAlso set a random SESSION_SECRET, e.g.:');
console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}\n`);
