import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../services/utils';

export const sendCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('sendCommand')!)
    .setDescription(rosetty.t('sendCommandDescription')!)
    .addStringOption((option) =>
      option.setName(rosetty.t('sendCommandOptionURL')!).setDescription(rosetty.t('sendCommandOptionURLDescription')!),
    )
    .addAttachmentOption((option) =>
      option
        .setName(rosetty.t('sendCommandOptionMedia')!)
        .setDescription(rosetty.t('sendCommandOptionMediaDescription')!),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('sendCommandOptionText')!)
        .setDescription(rosetty.t('sendCommandOptionTextDescription')!)
        .setRequired(false),
    ),
  handler: async (interaction: CommandInteraction) => {
    await interaction.deferReply();

    let url = interaction.options.get(rosetty.t('sendCommandOptionURL')!)?.value as string;
    const text = interaction.options.get(rosetty.t('sendCommandOptionText')!)?.value;
    const media = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.proxyURL;
    let mediaContentType = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.contentType;
    let mediaDuration = interaction.options.get(rosetty.t('sendCommandOptionMedia')!)?.attachment?.duration;

    let additionalContent;
    if ((!mediaContentType || !mediaDuration) && (media || url)) {
      additionalContent = await getContentInformationsFromUrl((media || url) as string);
      if (additionalContent?.directUrl) {
        url = additionalContent.directUrl;
      }
    }

    if ((mediaContentType === undefined || mediaContentType === null) && additionalContent?.contentType) {
      mediaContentType = additionalContent.contentType;
    }

    if ((mediaContentType === undefined || mediaDuration === null) && additionalContent?.mediaDuration) {
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
        author: interaction.user.username,
        authorImage: interaction.user.avatarURL(),
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
          .setDescription(rosetty.t('sendCommandAnswer')!)
          .setColor(0x2ecc71),
      ],
    });
  },
});
