import fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export const ClientRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'client.html'));

      reply.type('text/html');
      return stream;
    });

    // Route pour servir les fichiers vidéo convertis
    fastify.get('/api/media/:filename', async function (req, reply) {
      try {
        const { filename } = req.params as { filename: string };
        const cacheDir = join(tmpdir(), 'livechat-converted');
        const filePath = join(cacheDir, filename);

        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
          return reply.status(404).send({ error: 'File not found' });
        }

        // Déterminer le type MIME
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (ext === 'mp4') {
          contentType = 'video/mp4';
        } else if (ext === 'webm') {
          contentType = 'video/webm';
        } else if (ext === 'ogg') {
          contentType = 'video/ogg';
        }

        // Servir le fichier avec les bons headers
        reply.type(contentType);
        reply.header('Cache-Control', 'public, max-age=3600'); // Cache 1h
        reply.header('Accept-Ranges', 'bytes');
        
        const stream = fs.createReadStream(filePath);
        return stream;
      } catch (error) {
        console.error('Erreur lors du service du fichier:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
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
