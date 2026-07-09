const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchSchoolworks } = require('../lib/ledgerApi');

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

    try {
      let works = await fetchSchoolworks();
      if (courseFilter) {
        works = works.filter((w) => w.courseCode.toLowerCase() === courseFilter.toLowerCase());
      }
      works.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      works = works.filter((w) => new Date(w.deadline) > new Date()).slice(0, 10);

      if (!works.length) {
        return interaction.editReply(
          courseFilter ? `Nothing upcoming for **${courseFilter.toUpperCase()}**.` : 'Nothing upcoming right now. 🎉'
        );
      }

      const embed = new EmbedBuilder()
        .setTitle('📝 Upcoming School Works')
        .setColor(0xb5502f)
        .setDescription(
          works.map((w) => {
            const due = new Date(w.deadline);
            const dueStr = due.toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
            return `**${w.courseCode}** — ${w.title}\nDue ${dueStr}${w.description ? `\n${w.description}` : ''}`;
          }).join('\n\n')
        )
        .setFooter({ text: 'BSCS-DS 3A Sched' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`Couldn't load school works: ${err.message}`);
    }
  },
};
