import fs from 'fs';
import { join } from 'path';

export const ClientRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.get('/', async function (req, reply) {
      const stream = fs.createReadStream(join(__dirname, 'client.html'));

      reply.type('text/html');
      return stream;
    });

    // Route de test
    fastify.get('/test', async function (req, reply) {
      return { message: 'Route de test fonctionne !' };
    });

    // Route pour servir les fichiers statiques (sons)
    fastify.get('/static/sounds/:filename', async function (req, reply) {
      try {
        const { filename } = req.params as { filename: string };
        const filePath = join(process.cwd(), 'static', 'sounds', filename);
        
        console.log('🔍 Tentative de chargement du fichier son:', {
          filename,
          filePath,
          exists: fs.existsSync(filePath),
          cwd: process.cwd()
        });
        
        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
          console.log('❌ Fichier son non trouvé:', filePath);
          return reply.status(404).send({ error: 'File not found' });
        }
        
        console.log('✅ Fichier son trouvé, envoi...');
        const stream = fs.createReadStream(filePath);
        reply.type('audio/mpeg');
        return stream;
      } catch (error) {
        console.error('Erreur lors du chargement du fichier son:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    // Route alternative pour les sons (sans préfixe)
    fastify.get('/sounds/:filename', async function (req, reply) {
      try {
        const { filename } = req.params as { filename: string };
        const filePath = join(process.cwd(), 'static', 'sounds', filename);
        
        console.log('🔍 Route alternative - Tentative de chargement du fichier son:', {
          filename,
          filePath,
          exists: fs.existsSync(filePath),
          cwd: process.cwd()
        });
        
        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
          console.log('❌ Fichier son non trouvé:', filePath);
          return reply.status(404).send({ error: 'File not found' });
        }
        
        console.log('✅ Fichier son trouvé, envoi...');
        const stream = fs.createReadStream(filePath);
        reply.type('audio/mpeg');
        return stream;
      } catch (error) {
        console.error('Erreur lors du chargement du fichier son:', error);
        return reply.status(500).send({ error: 'Internal server error' });
      }
    });

    // Route directe pour le son image
    fastify.get('/image-sound.mp3', async function (req, reply) {
      try {
        const filePath = join(process.cwd(), 'static', 'sounds', 'image-sound.mp3');
        
        console.log('🔍 Route directe - Tentative de chargement du fichier son:', {
          filePath,
          exists: fs.existsSync(filePath),
          cwd: process.cwd()
        });
        
        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
          console.log('❌ Fichier son non trouvé:', filePath);
          return reply.status(404).send({ error: 'File not found' });
        }
        
        console.log('✅ Fichier son trouvé, envoi...');
        const stream = fs.createReadStream(filePath);
        reply.type('audio/mpeg');
        return stream;
      } catch (error) {
        console.error('Erreur lors du chargement du fichier son:', error);
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
