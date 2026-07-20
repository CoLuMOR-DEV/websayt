const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ComponentType,
} = require('discord.js');
const { fetchSchedule, formatTime12 } = require('../lib/ledgerApi');
const { manilaNow } = require('../../api/lib/manilaTime');

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_FULL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};
const DAY_SHORT = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };
const BRAND_COLOR = 0xE5E5E5;
const NAV_TIMEOUT_MS = 5 * 60 * 1000;

function buildEmbed(day, entries, todayCode) {
  return new EmbedBuilder()
    .setTitle(`📅 ${DAY_FULL[day]}${day === todayCode ? ' · Today' : ''}`)
    .setColor(BRAND_COLOR)
    .setDescription(
      entries.length
        ? entries.map((e) =>
            `**${e.courseCode}** — ${e.courseName}\n🕐 ${formatTime12(e.startTime)} – ${formatTime12(e.endTime)}${e.meetLink ? ' · 🔗 has a Meet link' : ''}`
          ).join('\n\n')
        : '_No classes scheduled._'
    )
    .setFooter({ text: 'BSCS-DS 3A Sched · Philippine Time · use the buttons to browse other days' })
    .setTimestamp();
}

function buildDayRow(activeDay) {
  const row = new ActionRowBuilder();
  DAYS.forEach((d) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`sched-day:${d}`)
        .setLabel(DAY_SHORT[d])
        .setStyle(d === activeDay ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  });
  return row;
}

function buildJoinRow(entries) {
  const linked = entries.filter((e) => e.meetLink).slice(0, 5);
  if (!linked.length) return null;
  return new ActionRowBuilder().addComponents(
    linked.map((e) =>
      new ButtonBuilder()
        .setLabel(`Join ${e.courseCode}`)
        .setStyle(ButtonStyle.Link)
        .setURL(e.meetLink)
    )
  );
}

function disabledDayRow(activeDay) {
  const row = buildDayRow(activeDay);
  row.components.forEach((c) => c.setDisabled(true));
  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription("Browse the week's class schedule")
    .addStringOption((opt) =>
      opt.setName('day')
        .setDescription('Which day to start on (defaults to today, Philippine time)')
        .addChoices(...DAYS.map((d) => ({ name: DAY_FULL[d], value: d })))
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const todayCode = manilaNow().dayCode;
    let activeDay = interaction.options.getString('day') || todayCode;

    let all;
    try {
      all = await fetchSchedule();
    } catch (err) {
      return interaction.editReply(`Couldn't load the schedule: ${err.message}`);
    }

    const entriesFor = (day) => all
      .filter((e) => e.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const components = () => {
      const rows = [buildDayRow(activeDay)];
      const joinRow = buildJoinRow(entriesFor(activeDay));
      if (joinRow) rows.push(joinRow);
      return rows;
    };

    const message = await interaction.editReply({
      embeds: [buildEmbed(activeDay, entriesFor(activeDay), todayCode)],
      components: components(),
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: NAV_TIMEOUT_MS,
      filter: (btn) => btn.customId.startsWith('sched-day:'),
    });

    collector.on('collect', async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: "This isn't your `/schedule` — run it yourself to browse.", ephemeral: true });
      }
      activeDay = btn.customId.split(':')[1];
      await btn.update({
        embeds: [buildEmbed(activeDay, entriesFor(activeDay), todayCode)],
        components: components(),
      });
    });

    collector.on('end', async () => {
      try {
        const joinRow = buildJoinRow(entriesFor(activeDay));
        await interaction.editReply({
          components: [disabledDayRow(activeDay), ...(joinRow ? [joinRow] : [])],
        });
      } catch { /* message may have been deleted; ignore */ }
    });
  },
};
