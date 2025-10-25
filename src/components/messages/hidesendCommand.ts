import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../services/utils';

export const hideSendCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('hideSendCommand')!)
    .setDescription(rosetty.t('hideSendCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionURL')!)
        .setDescription(rosetty.t('hideSendCommandOptionURLDescription')!),
    )
    .addAttachmentOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionMedia')!)
        .setDescription(rosetty.t('hideSendCommandOptionMediaDescription')!),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideSendCommandOptionText')!)
        .setDescription(rosetty.t('hideSendCommandOptionTextDescription')!)
        .setRequired(false),
    ),
  handler: async (interaction: CommandInteraction) => {
    // Différer la réponse pour éviter l'expiration de l'interaction
    await interaction.deferReply({ ephemeral: true });

    try {
      const url = interaction.options.get(rosetty.t('hideSendCommandOptionURL')!)?.value;
      const text = interaction.options.get(rosetty.t('hideSendCommandOptionText')!)?.value;
      const media = interaction.options.get(rosetty.t('hideSendCommandOptionMedia')!)?.attachment?.proxyURL;
      let mediaContentType = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.contentType;
      let mediaDuration = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.duration;

      let additionalContent;
      if ((!mediaContentType || !mediaDuration) && (media || url)) {
        additionalContent = await getContentInformationsFromUrl((media || url) as string);
      }

      if (mediaContentType === null && additionalContent?.contentType) {
        mediaContentType = additionalContent.contentType;
      }

      if (mediaDuration === null && additionalContent?.mediaDuration) {
        mediaDuration = additionalContent.mediaDuration;
      }

      await prisma.queue.create({
        data: {
          content: JSON.stringify({
            url,
            text,
            media,
            mediaContentType,
            mediaDuration: await getDurationFromGuildId(
              mediaDuration ? Math.ceil(mediaDuration) : undefined,
              interaction.guildId!,
            ),
            displayFull: await getDisplayMediaFullFromGuildId(interaction.guildId!),
          }),
          type: QueueType.MESSAGE,
          discordGuildId: interaction.guildId!,
          duration: await getDurationFromGuildId(
            mediaDuration ? Math.ceil(mediaDuration) : undefined,
            interaction.guildId!,
          ),
        },
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('success')!)
            .setDescription(rosetty.t('hideSendCommandAnswer')!)
            .setColor(0x2ecc71),
        ],
      });
    } catch (error) {
      // Gestion d'erreur si l'interaction a expiré
      if (interaction.replied || interaction.deferred) {
        try {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle(rosetty.t('error')!)
                .setDescription(rosetty.t('commandError')!)
                .setColor(0xe74c3c),
            ],
          });
        } catch (editError) {
          // Si editReply échoue, essayer followUp
          await interaction.followUp({
            embeds: [
              new EmbedBuilder()
                .setTitle(rosetty.t('error')!)
                .setDescription(rosetty.t('commandError')!)
                .setColor(0xe74c3c),
            ],
            ephemeral: true,
          });
        }
      } else {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(rosetty.t('error')!)
              .setDescription(rosetty.t('commandError')!)
              .setColor(0xe74c3c),
          ],
          ephemeral: true,
        });
      }
      
      throw error;
    }
  },
});
