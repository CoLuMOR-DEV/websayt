const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchSchoolworks } = require('../lib/ledgerApi');

const BRAND_COLOR = 0xE5E5E5;
const URGENT_COLOR = 0xff5c7a;
const SOON_COLOR = 0xa985ff;

function urgencyEmoji(deadline) {
  const hrs = (new Date(deadline) - new Date()) / 3600000;
  if (hrs < 24) return '🔴';
  if (hrs <= 72) return '🟠';
  return '🟢';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('schoolworks')
    .setDescription('Show upcoming school works (assignments)')
    .addStringOption((opt) =>
      opt.setName('course')
        .setDescription('Filter by course code, e.g. CS101')
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const courseFilter = interaction.options.getString('course');

    let works;
    try {
      works = await fetchSchoolworks();
    } catch (err) {
      return interaction.editReply(`Couldn't load school works: ${err.message}`);
    }

    if (courseFilter) {
      works = works.filter((w) => w.courseCode.toLowerCase() === courseFilter.toLowerCase());
    }
    works.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const upcoming = works.filter((w) => new Date(w.deadline) > new Date());
    const shown = upcoming.slice(0, 10);

    if (!shown.length) {
      const empty = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('📝 School Works')
        .setDescription(
          courseFilter
            ? `Nothing upcoming for **${courseFilter.toUpperCase()}**. 🎉`
            : 'Nothing upcoming right now. 🎉'
        )
        .setFooter({ text: 'BSCS-DS 3A Sched' });
      return interaction.editReply({ embeds: [empty] });
    }

    const nearestHrs = (new Date(shown[0].deadline) - new Date()) / 3600000;
    const color = nearestHrs < 24 ? URGENT_COLOR : nearestHrs <= 72 ? SOON_COLOR : BRAND_COLOR;

    const embed = new EmbedBuilder()
      .setTitle(`📝 Upcoming School Works${courseFilter ? ` · ${courseFilter.toUpperCase()}` : ''}`)
      .setColor(color)
      .setFooter({
        text: upcoming.length > shown.length
          ? `BSCS-DS 3A Sched · showing next ${shown.length} of ${upcoming.length}`
          : 'BSCS-DS 3A Sched',
      })
      .setTimestamp();

    shown.forEach((w) => {
      const unix = Math.floor(new Date(w.deadline).getTime() / 1000);
      embed.addFields({
        name: `${urgencyEmoji(w.deadline)} ${w.courseCode} — ${w.title}`,
        value: `Due <t:${unix}:f> · <t:${unix}:R>${w.description ? `\n${w.description}` : ''}`,
      });
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
