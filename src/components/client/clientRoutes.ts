import fs from 'fs';
import { join } from 'path';

export const ClientRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'client.html'));

      reply.type('text/html');
      return stream;
    });

    // Route pour vérifier si un utilisateur est blacklisté
    fastify.get('/api/blacklist/check/:userId', async function (req, reply) {
      try {
        const { userId } = req.params as { userId: string };
        const { guildId } = req.query as { guildId: string };

        if (!guildId) {
          return reply.status(400).send({ error: 'GuildId is required' });
        }

        const isBlacklisted = await prisma.blacklist.findFirst({
          where: {
            userId: userId,
            guildId: guildId,
          },
        });

        return { isBlacklisted: !!isBlacklisted };
      } catch (error) {
        console.error('Erreur lors de la vérification de blacklist:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });
  };
