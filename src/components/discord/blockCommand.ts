import { Client, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, User } from 'discord.js';
// prisma est disponible via global.prisma

export const blockCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('block')
    .setDescription('Bloque un utilisateur de toutes les commandes du bot')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Utilisateur à bloquer')
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

      // Vérifier si l'utilisateur est déjà bloqué
      const existingBlock = await global.prisma.blockedUser.findFirst({
        where: {
          userId: targetUser.id,
          guildId: guildId,
        },
      });

      if (existingBlock) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Utilisateur déjà bloqué')
              .setDescription(`${targetUser.username} est déjà bloqué.`)
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      // Bloquer l'utilisateur
      await global.prisma.blockedUser.create({
        data: {
          userId: targetUser.id,
          guildId: guildId,
          blockedBy: interaction.user.id,
        },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 Utilisateur bloqué')
            .setDescription(`${targetUser.username} a été bloqué de toutes les commandes du bot.`)
            .setColor(0xe74c3c),
        ],
      });
    } catch (error) {
      console.error('Erreur dans blockCommand:', error);
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
