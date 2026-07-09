// GET  /api/bot/config  -> current config, with the token masked
// POST /api/bot/config  -> save settings (send an empty/omitted token to
//                          keep the previously saved one unchanged)

const { isAuthenticated } = require('../../lib/auth');
const { readConfig, writeConfig, toPublicShape } = require('../../lib/botConfig');

module.exports = async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Login required' });

  if (req.method === 'GET') {
    return res.status(200).json(toPublicShape(readConfig()));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const update = {
      clientId: body.clientId !== undefined ? String(body.clientId).trim() : undefined,
      guildId: body.guildId !== undefined ? String(body.guildId).trim() : undefined,
      announceChannelId: body.announceChannelId !== undefined ? String(body.announceChannelId).trim() : undefined,
      dailyScheduleEnabled: body.dailyScheduleEnabled !== undefined ? !!body.dailyScheduleEnabled : undefined,
      dailyScheduleHour: body.dailyScheduleHour !== undefined ? Number(body.dailyScheduleHour) : undefined,
      deadlineRemindersEnabled: body.deadlineRemindersEnabled !== undefined ? !!body.deadlineRemindersEnabled : undefined,
      reminderLeadHours: body.reminderLeadHours !== undefined ? Number(body.reminderLeadHours) : undefined,
    };
    // Only overwrite the token if a non-empty one was actually submitted.
    if (body.token && String(body.token).trim()) {
      update.token = String(body.token).trim();
    }
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const saved = writeConfig(update);
    return res.status(200).json(toPublicShape(saved));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
