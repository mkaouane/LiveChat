import { Client, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
// prisma est disponible via global.prisma

export const unblockCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('unblock')
    .setDescription('Débloque un utilisateur (Admin seulement)')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Utilisateur à débloquer')
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

      // Vérifier si l'utilisateur est bloqué
      const blockedEntry = await global.prisma.blockedUser.findFirst({
        where: {
          userId: targetUser.id,
          guildId: guildId,
        },
      });

      if (!blockedEntry) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Utilisateur non bloqué')
              .setDescription(`${targetUser.username} n'est pas bloqué.`)
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      // Débloquer l'utilisateur
      await global.prisma.blockedUser.delete({
        where: {
          id: blockedEntry.id,
        },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Utilisateur débloqué')
            .setDescription(`${targetUser.username} a été débloqué et peut maintenant utiliser les commandes du bot.`)
            .setColor(0x2ecc71),
        ],
      });
    } catch (error) {
      console.error('Erreur dans unblockCommand:', error);
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
