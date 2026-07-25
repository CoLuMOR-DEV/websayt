const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Pings @everyone, so this is restricted to members who can manage the
// server (Discord also hides it from anyone without that permission,
// separately from the check below). If you want a different role able
// to use it, change the permission passed to setDefaultMemberPermissions,
// or set per-command permissions for it in Server Settings → Integrations.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement in this channel and ping everyone')
    .addStringOption((opt) =>
      opt.setName('message')
        .setDescription('The announcement text')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.channel || !interaction.channel.isTextBased()) {
      return interaction.reply({ content: "Can't post an announcement here.", ephemeral: true });
    }

    const message = interaction.options.getString('message', true);

    await interaction.reply({ content: 'Announcement posted.', ephemeral: true });
    await interaction.channel.send({
      content: `@everyone ${message}`,
      allowedMentions: { parse: ['everyone'] },
    });
  },
};
