const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchSchedule, formatTime12 } = require('../lib/ledgerApi');

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_FULL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription("Show a day's class schedule")
    .addStringOption((opt) =>
      opt.setName('day')
        .setDescription('Which day (defaults to today)')
        .addChoices(...DAYS.map((d) => ({ name: DAY_FULL[d], value: d })))
    ),

  async execute(interaction) {
    await interaction.deferReply();

    let day = interaction.options.getString('day');
    if (!day) day = DAYS[(new Date().getDay() + 6) % 7];

    try {
      const all = await fetchSchedule();
      const entries = all
        .filter((e) => e.day === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      if (!entries.length) {
        return interaction.editReply(`No classes scheduled for **${DAY_FULL[day]}**.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`📅 ${DAY_FULL[day]}'s Schedule`)
        .setColor(0x2f6f4e)
        .setDescription(
          entries.map((e) =>
            `**${e.courseCode}** — ${e.courseName}\n${formatTime12(e.startTime)} – ${formatTime12(e.endTime)}${e.meetLink ? ' · 🔗 has a Meet link' : ''}`
          ).join('\n\n')
        )
        .setFooter({ text: 'BSCS-DS 3A Sched' })
        .setTimestamp();

      const linked = entries.filter((e) => e.meetLink);
      const row = linked.length
        ? new ActionRowBuilder().addComponents(
            linked.slice(0, 5).map((e) =>
              new ButtonBuilder()
                .setLabel(`Join ${e.courseCode}`)
                .setStyle(ButtonStyle.Link)
                .setURL(e.meetLink)
            )
          )
        : null;

      await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
    } catch (err) {
      await interaction.editReply(`Couldn't load the schedule: ${err.message}`);
    }
  },
};
