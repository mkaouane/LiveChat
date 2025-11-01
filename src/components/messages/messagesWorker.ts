import { addMilliseconds, addSeconds } from 'date-fns';

export const executeMessagesWorker = async (fastify: FastifyCustomInstance) => {
  //Get last message
  const lastMessage = await prisma.queue.findFirst({
    where: {
      executionDate: {
        lte: new Date(),
      },
    },
    orderBy: {
      executionDate: 'asc',
    },
  });

  if (lastMessage === null) {
    logger.debug(`[SOCKET] No new message`);
    return;
  }

  //Check if queue is playing
  const guild = await prisma.guild.findFirst({
    where: {
      id: lastMessage.discordGuildId,
      busyUntil: {
        gte: new Date(),
      },
    },
  });

  if (guild) {
    await prisma.queue.update({
      where: {
        id: lastMessage.id,
      },
      data: {
        executionDate: addMilliseconds(new Date(), 250),
      },
    });
    return;
  } else {
    let busyUntil = addSeconds(new Date(), lastMessage.duration);

    //Safety mesure
    busyUntil = addMilliseconds(busyUntil, 250);

    await prisma.guild.upsert({
      where: {
        id: lastMessage.discordGuildId,
      },
      create: {
        id: lastMessage.discordGuildId,
        busyUntil,
      },
      update: {
        busyUntil,
      },
    });
  }

  // Vérifier si l'auteur est blacklisté
  if (lastMessage.authorId) {
    const isBlacklisted = await prisma.blacklist.findFirst({
      where: {
        userId: lastMessage.authorId,
        guildId: lastMessage.discordGuildId,
      },
    });

    if (isBlacklisted) {
      // Créer un message de blacklist
      const blacklistMessage = {
        ...lastMessage,
        content: JSON.stringify({
          url: 'https://i.pinimg.com/736x/2c/ec/55/2cec55117854b4f5218bd3274c7dbdfa.jpg',
          text: `${lastMessage.author} a essayé d'envoyer un LiveChat mais ${lastMessage.author} n'est pas drôle`,
          mediaContentType: 'image/jpeg',
          displayFull: false,
        }),
        author: lastMessage.author,
        authorId: lastMessage.authorId,
        authorImage: lastMessage.authorImage,
      };

      fastify.io.to(`messages-${lastMessage.discordGuildId}`).emit('new-message', blacklistMessage);
      logger.debug(`[SOCKET] Blacklist message ${lastMessage.id} (guild: ${lastMessage.discordGuildId}): User ${lastMessage.authorId} is blacklisted`);
    } else {
      fastify.io.to(`messages-${lastMessage.discordGuildId}`).emit('new-message', lastMessage);
      logger.debug(`[SOCKET] New message ${lastMessage.id} (guild: ${lastMessage.discordGuildId}): ${lastMessage.content}`);
    }
  } else {
  fastify.io.to(`messages-${lastMessage.discordGuildId}`).emit('new-message', lastMessage);
  logger.debug(`[SOCKET] New message ${lastMessage.id} (guild: ${lastMessage.discordGuildId}): ${lastMessage.content}`);
  }

  await prisma.queue.delete({ where: { id: lastMessage.id } });

  // Utiliser la durée appliquée côté serveur (bornée par la config guild)
  return (lastMessage.duration ?? 5) * 1000;
};

//INFO : Optimization - Can be executed into a dedicated worker ?
export const loadMessagesWorker = async (fastify: FastifyCustomInstance) => {
  await executeMessagesWorker(fastify);

  setTimeout(() => {
    loadMessagesWorker(fastify);
  }, 100);
};
