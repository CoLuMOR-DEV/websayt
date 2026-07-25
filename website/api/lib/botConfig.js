// api/lib/botConfig.js
//
// Stores the Discord bot's settings — token, guild/channel IDs, and which
// schedule-related features are turned on — in a local JSON file. This is
// intentionally NOT one of the public data/*.json collections: it holds a
// secret (the bot token), so it lives at data/bot-config.json, which is
// gitignored and never served by the static file middleware (it isn't
// under a path Express serves, and it's excluded in .gitignore either way).

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'bot-config.json');

const DEFAULTS = {
  token: '',
  clientId: '',
  guildId: '',
  announceChannelId: '',
  dailyScheduleEnabled: false,
  dailyScheduleHour: 7,
  deadlineRemindersEnabled: false,
  reminderLeadHours: 24,
  classReminderEnabled: false,
  newWorkAnnounceEnabled: true,
  wasRunning: false,
};

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS };
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeConfig(partial) {
  const current = readConfig();
  const next = { ...current, ...partial };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** Same shape as the config, but with the token masked for the browser. */
function toPublicShape(config) {
  const { token, ...rest } = config;
  return {
    ...rest,
    hasToken: !!token,
    tokenPreview: token ? `•••• ${token.slice(-4)}` : '',
  };
}

module.exports = { readConfig, writeConfig, toPublicShape, CONFIG_PATH };
