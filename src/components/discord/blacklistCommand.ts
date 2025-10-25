import { Client, CommandInteraction, EmbedBuilder, SlashCommandBuilder, User } from 'discord.js';

export const blacklistCommand = () => ({
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Lance un vote pour blacklister un utilisateur')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Utilisateur à blacklister')
        .setRequired(true),
    ),
  handler: async (interaction: CommandInteraction, discordClient: Client) => {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') as User;
      const guildId = interaction.guildId!;
      const voterId = interaction.user.id;

      // Vérifier si l'utilisateur est déjà blacklisté
      const existingBlacklist = await prisma.blacklist.findFirst({
        where: {
          userId: targetUser.id,
          guildId: guildId,
        },
      });

      if (existingBlacklist) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Utilisateur déjà blacklisté')
              .setDescription(`${targetUser.username} est déjà dans la blacklist.`)
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      // Vérifier si l'utilisateur a déjà voté pour cette personne
      const existingVote = await prisma.vote.findFirst({
        where: {
          targetUserId: targetUser.id,
          guildId: guildId,
          voterId: voterId,
        },
      });

      if (existingVote) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Vote déjà effectué')
              .setDescription(`Vous avez déjà voté pour blacklister ${targetUser.username}.`)
              .setColor(0xe74c3c),
          ],
        });
        return;
      }

      // Compter les votes existants
      const voteCount = await prisma.vote.count({
        where: {
          targetUserId: targetUser.id,
          guildId: guildId,
        },
      });

      // Créer le vote
      await prisma.vote.create({
        data: {
          targetUserId: targetUser.id,
          guildId: guildId,
          voterId: voterId,
        },
      });

      const newVoteCount = voteCount + 1;
      const votesNeeded = 5;
      const remainingVotes = votesNeeded - newVoteCount;

      if (newVoteCount >= votesNeeded) {
        // Blacklister l'utilisateur
        await prisma.blacklist.create({
          data: {
            userId: targetUser.id,
            guildId: guildId,
          },
        });

        // Supprimer tous les votes pour cet utilisateur
        await prisma.vote.deleteMany({
          where: {
            targetUserId: targetUser.id,
            guildId: guildId,
          },
        });

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🚫 Utilisateur blacklisté !')
              .setDescription(`${targetUser.username} a été blacklisté avec ${newVoteCount} votes.`)
              .setColor(0xe74c3c),
          ],
        });
      } else {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🗳️ Vote enregistré')
              .setDescription(
                `Vote pour blacklister ${targetUser.username} enregistré.\n` +
                `Votes: ${newVoteCount}/${votesNeeded}\n` +
                `Il reste ${remainingVotes} vote(s) nécessaire(s).`
              )
              .setColor(0xf39c12),
          ],
        });
      }
    } catch (error) {
      console.error('Erreur dans blacklistCommand:', error);
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

