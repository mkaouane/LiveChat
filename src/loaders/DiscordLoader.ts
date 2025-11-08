import {
  REST,
  Client,
  Events,
  Collection,
  Routes,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  IntentsBitField,
  SlashCommandBuilder,
  CommandInteraction,
} from 'discord.js';
import { aliveCommand } from '../components/discord/aliveCommand';
import { sendCommand } from '../components/messages/sendCommand';
import { hideSendCommand } from '../components/messages/hidesendCommand';
import { loadMessagesWorker } from '../components/messages/messagesWorker';
// prisma est disponible via global.prisma
import { talkCommand } from '../components/messages/talkCommand';
import { hideTalkCommand } from '../components/messages/hidetalkCommand';
import { clientCommand } from '../components/discord/clientCommand';
import { helpCommand } from '../components/discord/helpCommand';
// import { infoCommand } from '../components/discord/infoCommand';
import { setDefaultTimeCommand } from '../components/discord/setDefaultTimeCommand';
import { setDisplayMediaFullCommand } from '../components/discord/setDisplayFullCommand';
import { setMaxTimeCommand } from '../components/discord/setMaxTimeCommand';
import { blacklistCommand } from '../components/discord/blacklistCommand';
import { unblacklistCommand } from '../components/discord/unblacklistCommand';
import { blockCommand } from '../components/discord/blockCommand';
import { unblockCommand } from '../components/discord/unblockCommand';
import { stopCommand } from '../components/messages/stopCommand';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const loadDiscord = async (fastify: FastifyCustomInstance) => {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  global.discordRest = rest;

  const client = new Client({ intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
  ] });
  global.discordClient = client;

  // Load all discord commands
  await loadDiscordCommands(fastify);
  loadDiscordCommandsHandler();
  loadMessagesWorker(fastify);

  // --- Message quota for a specific user ---
  // Per guild counters: { date: YYYY-MM-DD, count }
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guildId) return;
      if (message.author.id !== LIMITED_USER_ID) return;

      const today = new Date().toISOString().slice(0, 10);
      const key = message.guildId;
      let state = userDailyCounters.get(key);
      if (!state || state.date !== today) {
        state = { date: today, count: 0 };
        userDailyCounters.set(key, state);
      }

      if (state.count >= getDailyLimit(message.guildId)) {
        // Over quota: delete message and notify
        try {
          await message.delete();
        } catch (err) {
          logger.error(err);
        }
        try {
          await message.channel.send(`<@${message.author.id}> a dépassé son quota de message par jour merci de revenir demain`);
        } catch (err) {
          logger.error(err);
        }
        return;
      }

      // Count this message
      state.count += 1;
      const remaining = getDailyLimit(message.guildId) - state.count;

      if (state.count % REMINDER_EVERY === 0 && remaining > 0) {
        try {
          await message.channel.send(`<@${message.author.id}> Plus que ${remaining} messages restants`);
        } catch (err) {
          logger.error(err);
        }
      }
    } catch (error) {
      logger.error(error);
    }
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`[DISCORD] ${rosetty.t('discordBotReady', { username: readyClient.user.tag })}`);
    logger.info(
      `[DISCORD] ${rosetty.t('discordInvite', {
        link: `https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=bot`,
      })}`,
    );
  });

  client.on(Events.GuildCreate, (g) => {
    const channel = g.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.permissionsFor(g.members.me!).has(PermissionFlagsBits.SendMessages),
    );

    if (channel && channel.isTextBased()) {
      channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(rosetty.t('howToUseTitle')!)
            .setDescription(rosetty.t('howToUseDescription')!)
            .setColor(0x3498db),
        ],
      });
    }
  });

  await client.login(env.DISCORD_TOKEN);
};

const loadDiscordCommands = async (fastify: FastifyCustomInstance) => {
  try {
    logger.info(`[DISCORD] ${rosetty.t('discordCommands')}`);

    //@ts-ignore
    discordClient.commands = new Collection();

    const discordCommandsToRegister = [];

    // Inline admin commands for quota management
    const resetQuotaCommand = () => ({
      data: new SlashCommandBuilder()
        .setName('quota-reset')
        .setDescription('Réinitialiser le compteur de messages du jour pour un utilisateur (Admin)')
        .addUserOption((option) =>
          option.setName('user').setDescription("Utilisateur cible").setRequired(true),
        ),
      handler: async (interaction: CommandInteraction, discordClient: Client) => {
        const target = interaction.options.get('user')?.user;
        const guildId = interaction.guildId!;

        // Check admin
        const userId = interaction.user.id;
        const guildMember = await discordClient.guilds
          .fetch(guildId)
          .then((guild) => guild.members.fetch(userId));
        if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
            ephemeral: true,
          });
          return;
        }

        if (!target || target.id !== LIMITED_USER_ID) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Utilisateur non géré')
                .setDescription(`Cette commande ne s'applique qu'à <@${LIMITED_USER_ID}>`)
                .setColor(0xe74c3c),
            ],
            ephemeral: true,
          });
          return;
        }

        const today = new Date().toISOString().slice(0, 10);
        userDailyCounters.set(guildId, { date: today, count: 0 });

        await interaction.reply({
          embeds: [
            new EmbedBuilder().setTitle('✅ Compteur réinitialisé').setDescription(`Le compteur de <@${target.id}> a été réinitialisé pour aujourd'hui`).setColor(0x2ecc71),
          ],
          ephemeral: true,
        });

        // Message public
        try {
          const channel = (interaction.channel as any);
          await channel.send(`Le compteur de <@${target.id}> a été réinitialisé pour aujourd'hui.`);
        } catch (e) {
          logger.error(e);
        }
      },
    });

    const giveMessagesCommand = () => ({
      data: new SlashCommandBuilder()
        .setName('quota-give')
        .setDescription("Offrir des messages supplémentaires pour aujourd'hui (Admin)")
        .addUserOption((option) => option.setName('user').setDescription('Utilisateur cible').setRequired(true))
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription("Nombre de messages à offrir")
            .setRequired(true),
        ),
      handler: async (interaction: CommandInteraction, discordClient: Client) => {
        const target = interaction.options.get('user')?.user;
        const amount = interaction.options.get('amount')?.value as number;
        const guildId = interaction.guildId!;

        // Check admin
        const userId = interaction.user.id;
        const guildMember = await discordClient.guilds
          .fetch(guildId)
          .then((guild) => guild.members.fetch(userId));
        if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
            ephemeral: true,
          });
          return;
        }

        if (!target || target.id !== LIMITED_USER_ID) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Utilisateur non géré')
                .setDescription(`Cette commande ne s'applique qu'à <@${LIMITED_USER_ID}>`)
                .setColor(0xe74c3c),
            ],
            ephemeral: true,
          });
          return;
        }

        if (!amount || amount <= 0) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder().setTitle('❌ Montant invalide').setDescription('Le nombre doit être supérieur à 0').setColor(0xe74c3c),
            ],
            ephemeral: true,
          });
          return;
        }

        const today = new Date().toISOString().slice(0, 10);
        let state = userDailyCounters.get(guildId);
        if (!state || state.date !== today) {
          state = { date: today, count: 0 };
        }
        // Offrir des messages: on réduit le count (messages utilisés)
        state.count = Math.max(0, state.count - amount);
        userDailyCounters.set(guildId, state);

        await interaction.reply({
          embeds: [
            new EmbedBuilder().setTitle('✅ Messages offerts').setDescription(`${amount} messages ont été offerts à <@${target.id}>`).setColor(0x2ecc71),
          ],
          ephemeral: true,
        });

        // Message public
        try {
          const channel = (interaction.channel as any);
          await channel.send(`${amount} messages t'ont été offert <@${target.id}> tache d'en faire bon usage`);
        } catch (e) {
          logger.error(e);
        }
      },
    });

    const setLimitCommand = () => ({
      data: new SlashCommandBuilder()
        .setName('quota-setlimit')
        .setDescription('Définir la limite quotidienne de messages (Admin)')
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('Nouvelle limite quotidienne (par défaut 20)').setRequired(true),
        ),
      handler: async (interaction: CommandInteraction, discordClient: Client) => {
        const amount = interaction.options.get('amount')?.value as number;
        const guildId = interaction.guildId!;

        // Admin check
        const userId = interaction.user.id;
        const guildMember = await discordClient.guilds
          .fetch(guildId)
          .then((guild) => guild.members.fetch(userId));
        if (!guildMember.permissions.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle(rosetty.t('notAllowed')!).setColor(0xe74c3c)],
            ephemeral: true,
          });
          return;
        }

        if (!amount || amount <= 0) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('❌ Limite invalide').setDescription('La limite doit être > 0').setColor(0xe74c3c)],
            ephemeral: true,
          });
          return;
        }

        guildDailyLimit.set(guildId, Math.max(1, Math.floor(amount)));

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Limite mise à jour')
              .setDescription(`La limite quotidienne est maintenant de ${guildDailyLimit.get(guildId)} messages.`)
              .setColor(0x2ecc71),
          ],
          ephemeral: true,
        });
      },
    });

    const commands = [
      aliveCommand(),
      sendCommand(),
      talkCommand(),
      clientCommand(),
      helpCommand(),
      // infoCommand(),
      setDefaultTimeCommand(),
      setDisplayMediaFullCommand(),
      setMaxTimeCommand(),
      blacklistCommand(),
      unblacklistCommand(),
      blockCommand(),
      unblockCommand(),
      setLimitCommand(),
      resetQuotaCommand(),
      giveMessagesCommand(),
      stopCommand(fastify),
    ];
    const hideCommands = [hideSendCommand(), hideTalkCommand()];

    if (env.HIDE_COMMANDS_DISABLED !== 'true') {
      commands.push(...hideCommands);
    }

    global.commandsLoaded = [];

    for (const command of commands) {
      //@ts-ignore
      discordClient.commands.set(command.data.name, command);
      //@ts-ignore
      discordCommandsToRegister.push(command.data.toJSON());

      global.commandsLoaded.push(command.data.name);

      logger.info(`[DISCORD] ${rosetty.t('discordCommandLoaded', { command: command.data.name })}`);
    }

    await discordRest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: discordCommandsToRegister });
  } catch (error) {
    logger.error(error);
  }
};

const loadDiscordCommandsHandler = () => {
  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    //@ts-ignore
    const command = discordClient.commands.get(interaction.commandName);

    if (!command) {
      return;
    }

    // Vérifier si l'utilisateur est bloqué (sauf pour les commandes admin)
    const isAdminCommand = ['block', 'unblock', 'blacklist', 'unblacklist', 'config-defaut', 'config-displayfull', 'config-max'].includes(interaction.commandName);
    
    if (!isAdminCommand) {
      //@ts-ignore
      const isBlocked = await global.prisma.blockedUser.findFirst({
        where: {
          userId: interaction.user.id,
          guildId: interaction.guildId!,
        },
      });

      if (isBlocked) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🚫 Accès bloqué')
              .setDescription('Vous êtes bloqué de toutes les commandes du bot.')
              .setColor(0xe74c3c),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    try {
      await command.handler(interaction, discordClient);
    } catch (error) {
      logger.error(error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setTitle(rosetty.t('error')!)
              .setDescription(rosetty.t('commandError')!)
              .setColor(0xe74c3c),
          ],
          ephemeral: true,
        });
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
    }
  });
};

// --- Message quota for a specific user ---
const LIMITED_USER_ID = '161855974754222080';
//const LIMITED_USER_ID = '284374561133297674';
const REMINDER_EVERY = 5;
const userDailyCounters: Map<string, { date: string; count: number }> = new Map();
const guildDailyLimit: Map<string, number> = new Map();
const DEFAULT_DAILY_LIMIT = 20;
const getDailyLimit = (guildId: string) => guildDailyLimit.get(guildId) ?? DEFAULT_DAILY_LIMIT;
