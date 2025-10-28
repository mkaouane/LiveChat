import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { QueueType } from '../../services/prisma/loadPrisma';
import { getContentInformationsFromUrl } from '../../services/content-utils';
import { getDisplayMediaFullFromGuildId, getDurationFromGuildId } from '../../services/utils';
import { videoConverter } from '../../services/video-converter';

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

    // Conversion automatique des fichiers Discord pour compatibilité
    let finalUrl = url;
    let finalMedia = media;
    
    if (url && (url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net'))) {
      console.log('🔄 Conversion automatique fichier Discord:', url);
      const conversionResult = await videoConverter.convertDiscordVideo(url);
      
      if (conversionResult.success && conversionResult.convertedUrl) {
        finalUrl = conversionResult.convertedUrl;
        console.log('✅ Fichier Discord converti:', conversionResult.cached ? '(cache)' : '(nouveau)');
      } else {
        console.log('⚠️ Conversion échouée, utilisation originale:', conversionResult.error);
      }
    }
    
    if (media && (media.includes('cdn.discordapp.com') || media.includes('media.discordapp.net'))) {
      console.log('🔄 Conversion automatique média Discord:', media);
      const conversionResult = await videoConverter.convertDiscordVideo(media);
      
      if (conversionResult.success && conversionResult.convertedUrl) {
        finalMedia = conversionResult.convertedUrl;
        console.log('✅ Média Discord converti:', conversionResult.cached ? '(cache)' : '(nouveau)');
      } else {
        console.log('⚠️ Conversion échouée, utilisation originale:', conversionResult.error);
      }
    }

    // Log détaillé de la commande
    const timestamp = new Date().toLocaleString('fr-FR');
    const mediaInfo = finalMedia || finalUrl || 'Aucun média';
    console.log(`[${timestamp}] 📤 /msg - Utilisateur: ${interaction.user.username} (${interaction.user.id})`);
    console.log(`[${timestamp}] 📝 Texte: ${text || 'Aucun texte'}`);
    console.log(`[${timestamp}] 🎬 Média/Lien: ${mediaInfo}`);
    console.log(`[${timestamp}] ⏱️ Durée: ${mediaDuration ? Math.ceil(mediaDuration) + 's' : 'Par défaut'}`);

    await prisma.queue.create({
      data: {
        content: JSON.stringify({
          url: finalUrl,
          text,
          media: finalMedia,
          mediaContentType,
          mediaDuration: await getDurationFromGuildId(
            mediaDuration ? Math.ceil(mediaDuration) : undefined,
            interaction.guildId!,
          ),
          displayFull: await getDisplayMediaFullFromGuildId(interaction.guildId!),
        }),
        type: QueueType.MESSAGE,
        author: interaction.user.username,
        authorId: interaction.user.id,
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
