// api/lib/botManager.js
//
// Runs the Discord bot INSIDE this same long-lived Node process, so it can
// be started/stopped from the admin panel instead of being a separate
// process you manage by hand. This only works because server.js is an
// always-on server — it would not work on Vercel serverless, since a bot
// needs to hold one persistent WebSocket connection open.
//
// It reuses the exact slash commands in bot/commands/ unmodified (they
// just call the site's own public GET /api/schedule and /api/schoolworks
// endpoints), and adds three extra schedule-aware features on top, driven
// by the admin panel's toggles:
//   - Daily schedule post: posts today's periods to a channel every day
//     at a configured hour.
//   - Class-start reminders: posts a reminder 30, 20, and 5 minutes before
//     each class starts, then deletes those reminder messages an hour
//     after the class ends.
//   - Deadline reminders: posts a reminder when a school work's deadline
//     is within a configured number of hours away.

const fs = require('fs');
const path = require('path');
const { readConfig, writeConfig } = require('./botConfig');
const { readCollection } = require('./store');
const { manilaNow, formatManila } = require('./manilaTime');

let client = null;
let dailyTimer = null;
let reminderTimer = null;
let classReminderTimer = null;
let lastDailyPostDate = null; // 'YYYY-MM-DD' (Manila), so we only post once per day
const remindedWorkIds = new Set(); // in-memory only; resets on restart

// Class-start reminders: for each schedule entry we track which lead times
// (30/20/5 min before) have already been announced today, plus the IDs of
// the messages we posted, so they can be deleted again an hour after the
// class ends. Keyed by `${dateKey}:${entryId}`. In-memory only — resets on
// restart, same as the deadline-reminder tracking above.
const CLASS_REMINDER_LEADS_MIN = [30, 20, 5];
const CLASS_MESSAGE_CLEANUP_DELAY_MIN = 60;
const classReminderState = new Map();

function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

let status = { running: false, starting: false, tag: null, lastError: null };

function getStatus() {
  return { ...status };
}

function loadCommands() {
  const commandsPath = path.join(__dirname, '..', '..', 'bot', 'commands');
  const collection = new Map();
  for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
    delete require.cache[require.resolve(path.join(commandsPath, file))];
    const command = require(path.join(commandsPath, file));
    collection.set(command.data.name, command);
  }
  return collection;
}

function formatTime12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

async function postDailySchedule(config) {
  if (!config.announceChannelId) return;
  const { dayCode, hour, dateKey } = manilaNow();
  if (hour !== Number(config.dailyScheduleHour)) return;
  if (lastDailyPostDate === dateKey) return;

  const { EmbedBuilder } = require('discord.js');
  const all = await readCollection('schedule');
  const entries = all
    .filter((e) => e.day === dayCode)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const embed = new EmbedBuilder()
    .setTitle("📅 Today's Schedule")
    .setColor(0xE5E5E5)
    .setDescription(
      entries.length
        ? entries.map((e) =>
            `**${e.courseCode}** — ${e.courseName}\n${formatTime12(e.startTime)} – ${formatTime12(e.endTime)}${e.meetLink ? ` · [Join](${e.meetLink})` : ''}`
          ).join('\n\n')
        : 'No classes scheduled today.'
    )
    .setFooter({ text: 'BSCS-DS 3A Sched · Philippine Time' })
    .setTimestamp();

  try {
    const channel = await client.channels.fetch(config.announceChannelId);
    await channel.send({ embeds: [embed] });
    lastDailyPostDate = dateKey;
  } catch (err) {
    status.lastError = `Daily post failed: ${err.message}`;
  }
}

async function postDeadlineReminders(config) {
  if (!config.announceChannelId) return;
  const { EmbedBuilder } = require('discord.js');
  const works = await readCollection('schoolworks');
  const now = Date.now();
  const leadMs = Number(config.reminderLeadHours) * 60 * 60 * 1000;

  const due = works.filter((w) => {
    if (remindedWorkIds.has(w.id)) return false;
    const deadline = new Date(w.deadline).getTime();
    return deadline > now && deadline - now <= leadMs;
  });

  if (!due.length) return;

  try {
    const channel = await client.channels.fetch(config.announceChannelId);
    for (const w of due) {
      const embed = new EmbedBuilder()
        .setTitle('⏰ Deadline reminder')
        .setColor(0xff5c7a)
        .setDescription(
          `**${w.courseCode}** — ${w.title}\nDue ${formatManila(w.deadline)} PHT${w.description ? `\n${w.description}` : ''}`
        )
        .setFooter({ text: 'BSCS-DS 3A Sched · Philippine Time' });
      await channel.send({ embeds: [embed] });
      remindedWorkIds.add(w.id);
    }
  } catch (err) {
    status.lastError = `Reminder post failed: ${err.message}`;
  }
}

async function postClassReminders(config) {
  if (!config.announceChannelId || !client) return;

  const { EmbedBuilder } = require('discord.js');
  const { dayCode, hour, minute, dateKey } = manilaNow();
  const nowMin = hour * 60 + minute;

  // Drop any tracked state left over from a previous day.
  for (const key of classReminderState.keys()) {
    if (!key.startsWith(`${dateKey}:`)) classReminderState.delete(key);
  }

  const all = await readCollection('schedule');
  const entries = all.filter((e) => e.day === dayCode);

  for (const entry of entries) {
    const key = `${dateKey}:${entry.id}`;
    const state = classReminderState.get(key) || { sent: new Set(), messages: [] };
    const startMin = parseHHMM(entry.startTime);
    const endMin = parseHHMM(entry.endTime);
    const remainingToStart = startMin - nowMin;

    // Post any lead-time reminder whose threshold we've now reached (or
    // passed, in case a tick was missed) and haven't sent yet today.
    if (remainingToStart >= 0) {
      for (const lead of CLASS_REMINDER_LEADS_MIN) {
        if (remainingToStart <= lead && !state.sent.has(lead)) {
          state.sent.add(lead); // mark first, so a send failure can't retry-loop every tick
          try {
            const channel = await client.channels.fetch(config.announceChannelId);
            const embed = new EmbedBuilder()
              .setTitle(`⏳ ${entry.courseCode} starts in ${lead} minute${lead === 1 ? '' : 's'}`)
              .setColor(0xE5E5E5)
              .setDescription(
                `**${entry.courseCode}** — ${entry.courseName}\n🕐 ${formatTime12(entry.startTime)} – ${formatTime12(entry.endTime)}` +
                (entry.meetLink ? `\n🔗 [Join Google Meet](${entry.meetLink})` : '')
              )
              .setFooter({ text: 'BSCS-DS 3A Sched · Philippine Time' })
              .setTimestamp();
            const message = await channel.send({ embeds: [embed] });
            state.messages.push({ id: message.id, channelId: channel.id });
          } catch (err) {
            status.lastError = `Class reminder failed: ${err.message}`;
          }
        }
      }
    }

    // An hour after the class ends, delete every reminder message we
    // posted for it and stop tracking it.
    const elapsedSinceEnd = nowMin - endMin;
    if (elapsedSinceEnd >= CLASS_MESSAGE_CLEANUP_DELAY_MIN && state.messages.length) {
      for (const msg of state.messages) {
        try {
          const channel = await client.channels.fetch(msg.channelId);
          await channel.messages.delete(msg.id);
        } catch { /* already deleted, or missing perms — nothing more to do */ }
      }
      state.messages = [];
    }

    classReminderState.set(key, state);
  }
}

async function announceNewSchoolwork(work) {
  const config = readConfig();
  if (!status.running || !client || !config.announceChannelId || !config.newWorkAnnounceEnabled) return;

  const { EmbedBuilder } = require('discord.js');
  const unix = Math.floor(new Date(work.deadline).getTime() / 1000);
  const embed = new EmbedBuilder()
    .setTitle('🆕 New school work posted')
    .setColor(0xE5E5E5)
    .setDescription(
      `**${work.courseCode}** — ${work.title}\nDue <t:${unix}:f> · <t:${unix}:R>${work.description ? `\n${work.description}` : ''}`
    )
    .setFooter({ text: 'BSCS-DS 3A Sched' })
    .setTimestamp();

  try {
    const channel = await client.channels.fetch(config.announceChannelId);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    status.lastError = `New work announcement failed: ${err.message}`;
  }
}

function clearTimers() {
  if (dailyTimer) clearInterval(dailyTimer);
  if (reminderTimer) clearInterval(reminderTimer);
  if (classReminderTimer) clearInterval(classReminderTimer);
  dailyTimer = null;
  reminderTimer = null;
  classReminderTimer = null;
}

async function start(configOverride) {
  if (status.running || status.starting) {
    return getStatus();
  }
  const config = configOverride || readConfig();
  if (!config.token) {
    status.lastError = 'No bot token saved yet.';
    return getStatus();
  }

  status.starting = true;
  status.lastError = null;

  const { Client, GatewayIntentBits, Collection } = require('discord.js');

  // The bundled bot/commands/*.js talk to this site's own public API.
  if (!process.env.SITE_URL) {
    process.env.SITE_URL = `http://localhost:${process.env.PORT || 3000}`;
  }

  const newClient = new Client({ intents: [GatewayIntentBits.Guilds] });
  newClient.commands = new Collection();
  for (const [name, command] of loadCommands()) {
    newClient.commands.set(name, command);
  }

  newClient.once('ready', () => {
    status.running = true;
    status.starting = false;
    status.tag = newClient.user.tag;
    status.lastError = null;
    console.log(`Discord bot online as ${newClient.user.tag}`);
  });

  newClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = newClient.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      const payload = { content: 'Something went wrong running that command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
      else await interaction.reply(payload);
    }
  });

  clearTimers();
  dailyTimer = setInterval(() => {
    const cfg = readConfig();
    if (cfg.dailyScheduleEnabled) postDailySchedule(cfg).catch(() => {});
  }, 60 * 1000);
  reminderTimer = setInterval(() => {
    const cfg = readConfig();
    if (cfg.deadlineRemindersEnabled) postDeadlineReminders(cfg).catch(() => {});
  }, 5 * 60 * 1000);
  classReminderTimer = setInterval(() => {
    const cfg = readConfig();
    if (cfg.classReminderEnabled) postClassReminders(cfg).catch(() => {});
  }, 60 * 1000);

  try {
    await newClient.login(config.token);
    client = newClient;
    writeConfig({ wasRunning: true });
  } catch (err) {
    status.starting = false;
    status.running = false;
    status.lastError = `Login failed: ${err.message}`;
    clearTimers();
  }

  return getStatus();
}

async function stop() {
  clearTimers();
  if (client) {
    try {
      await client.destroy();
    } catch { /* ignore */ }
    client = null;
  }
  status = { running: false, starting: false, tag: null, lastError: null };
  writeConfig({ wasRunning: false });
  return getStatus();
}

async function deployCommands(configOverride) {
  const config = configOverride || readConfig();
  if (!config.token) throw new Error('Save a bot token first.');

  const clientId = config.clientId || (client && client.user && client.user.id);
  if (!clientId) {
    throw new Error('Client ID is required the first time (before the bot has logged in once).');
  }

  const { REST, Routes } = require('discord.js');
  const commands = [];
  for (const [, command] of loadCommands()) commands.push(command.data.toJSON());

  const rest = new REST().setToken(config.token);
  const target = config.guildId
    ? Routes.applicationGuildCommands(clientId, config.guildId)
    : Routes.applicationCommands(clientId);

  const data = await rest.put(target, { body: commands });
  return { count: data.length, scope: config.guildId ? 'guild' : 'global' };
}

/** Called once at server boot. Best-effort — never throws. */
async function autoStartIfConfigured() {
  try {
    const config = readConfig();
    if (config.wasRunning && config.token) {
      console.log('Resuming the Discord bot from its last saved state…');
      await start(config);
    }
  } catch (err) {
    console.warn('Could not auto-start the Discord bot:', err.message);
  }
}

module.exports = { start, stop, getStatus, deployCommands, autoStartIfConfigured, announceNewSchoolwork };
