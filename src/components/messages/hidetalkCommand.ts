import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { deleteGtts, promisedGtts, readGttsAsStream } from '../../services/gtts';
import { getDurationFromGuildId } from '../../services/utils';
import { env } from '../../services/env';

export const hideTalkCommand = () => ({
  data: new SlashCommandBuilder()
    .setName(rosetty.t('hideTalkCommand')!)
    .setDescription(rosetty.t('hideTalkCommandDescription')!)
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideTalkCommandOptionVoice')!)
        .setDescription(rosetty.t('hideTalkCommandOptionVoiceDescription')!)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName(rosetty.t('hideTalkCommandOptionText')!)
        .setDescription(rosetty.t('hideTalkCommandOptionTextDescription')!),
    ),
  handler: async (interaction: CommandInteraction) => {
    // Différer la réponse pour éviter l'expiration de l'interaction
    await interaction.deferReply({ ephemeral: true });

    try {
      const text = interaction.options.get(rosetty.t('hideTalkCommandOptionText')!)?.value;
      const voice = interaction.options.get(rosetty.t('hideTalkCommandOptionVoice')!)?.value;

      const filePath = await promisedGtts(voice, rosetty.getCurrentLang());

      const fileStream = readGttsAsStream(filePath);

      const interactionReply = await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('success')!)
            .setDescription(rosetty.t('hideTalkCommandAnswer')!)
            .setColor(0x2ecc71),
        ],
        files: [fileStream],
      });
      // Le message retourné par editReply est suffisant, inutile de le refetch (évite 10008 Unknown Message)
      const message = interactionReply;
      const media = message.attachments.first()?.proxyURL;

      const additionalContent = await getContentInformationsFromUrl(media as string);

      await deleteGtts(filePath);

      const reveal = Math.random() * 100 < env.REVEAL_ANON_PROB;

      await prisma.queue.create({
        data: {
          content: JSON.stringify({
            text,
            media,
            mediaContentType: 'audio/mpeg',
            mediaDuration: Math.ceil(additionalContent.mediaDuration),
            revealed: reveal,
          }),
          type: QueueType.VOCAL,
          author: reveal ? interaction.user.username : null,
          authorImage: reveal ? interaction.user.avatarURL() : null,
          discordGuildId: interaction.guildId!,
          duration: await getDurationFromGuildId(
            additionalContent.mediaDuration ? Math.ceil(additionalContent.mediaDuration) : undefined,
            interaction.guildId!,
          ),
        },
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
