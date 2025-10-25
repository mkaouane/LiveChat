import { Client, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';

export const unblacklistCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('Retire un utilisateur de la blacklist (Admin seulement)')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Utilisateur à retirer de la blacklist')
        .setRequired(true),
    ),
  handler: async (interaction: CommandInteraction, discordClient: Client) => {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const guildMember = await discordClient.guilds
        .fetch(interaction.guildId!)
        .then((guild) => guild.members.fetch(userId!));

      if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Permission refusée')
              .setDescription('Seuls les administrateurs peuvent utiliser cette commande.')
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      const targetUser = interaction.options.getUser('user') as User;
      const guildId = interaction.guildId!;

      // Vérifier si l'utilisateur est blacklisté
      const blacklistEntry = await prisma.blacklist.findFirst({
        where: {
          userId: targetUser.id,
          guildId: guildId,
        },
      });

      if (!blacklistEntry) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Utilisateur non blacklisté')
              .setDescription(`${targetUser.username} n'est pas dans la blacklist.`)
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      // Retirer de la blacklist
      await prisma.blacklist.delete({
        where: {
          id: blacklistEntry.id,
        },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Utilisateur retiré de la blacklist')
            .setDescription(`${targetUser.username} a été retiré de la blacklist.`)
            .setColor(0x2ecc71),
        ],
      });
    } catch (error) {
      console.error('Erreur dans unblacklistCommand:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Erreur')
            .setDescription('Une erreur est survenue lors du traitement de la commande.')
            .setColor(0xe74c3c),
        ],
      });
    }
  },
});

