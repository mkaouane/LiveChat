import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

interface ConversionResult {
  success: boolean;
  convertedUrl?: string;
  originalUrl?: string;
  error?: string;
  cached?: boolean;
}

class VideoConverter {
  private cacheDir: string;
  private tempDir: string;

  constructor() {
    this.cacheDir = join(tmpdir(), 'livechat-converted');
    this.tempDir = join(tmpdir(), 'livechat-temp');
    this.initializeDirectories();
  }

  private async initializeDirectories() {
    try {
      await mkdir(this.cacheDir, { recursive: true });
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.log('⚠️ Erreur création dossiers:', error);
    }
  }

  /**
   * Vérifie si une URL est un fichier Discord
   */
  private isDiscordUrl(url: string): boolean {
    return url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net');
  }

  /**
   * Génère un hash pour le cache basé sur l'URL
   */
  private generateCacheKey(url: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * Vérifie si le fichier converti existe en cache
   */
  private async isCached(cacheKey: string): Promise<string | null> {
    try {
      const cachedFile = join(this.cacheDir, `${cacheKey}.mp4`);
      await readFile(cachedFile); // Vérifie que le fichier existe
      return cachedFile;
    } catch {
      return null;
    }
  }

  /**
   * Analyse les codecs d'un fichier vidéo
   */
  private async analyzeVideoCodecs(filePath: string): Promise<{ video: string; audio: string }> {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${filePath}"`);
      const data = JSON.parse(stdout);
      
      let videoCodec = 'unknown';
      let audioCodec = 'unknown';

      for (const stream of data.streams) {
        if (stream.codec_type === 'video') {
          videoCodec = stream.codec_name;
        } else if (stream.codec_type === 'audio') {
          audioCodec = stream.codec_name;
        }
      }

      return { video: videoCodec, audio: audioCodec };
    } catch (error) {
      console.log('❌ Erreur analyse codecs:', error);
      return { video: 'unknown', audio: 'unknown' };
    }
  }

  /**
   * Convertit un fichier vidéo pour une compatibilité maximale
   */
  private async convertVideo(inputPath: string, outputPath: string): Promise<boolean> {
    try {
      console.log('🔄 Conversion vidéo en cours...');
      
      // Commande FFmpeg optimisée pour compatibilité maximale
      const command = `ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && stderr.includes('error')) {
        console.log('❌ Erreur conversion FFmpeg:', stderr);
        return false;
      }

      console.log('✅ Conversion réussie');
      return true;
    } catch (error) {
      console.log('❌ Erreur conversion:', error);
      return false;
    }
  }

  /**
   * Télécharge un fichier depuis une URL
   */
  private async downloadFile(url: string, outputPath: string): Promise<boolean> {
    try {
      console.log('📥 Téléchargement:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('❌ Erreur téléchargement:', response.status);
        return false;
      }

      const buffer = await response.arrayBuffer();
      await writeFile(outputPath, new Uint8Array(buffer));
      
      console.log('✅ Téléchargement réussi');
      return true;
    } catch (error) {
      console.log('❌ Erreur téléchargement:', error);
      return false;
    }
  }

  /**
   * Convertit une URL Discord en fichier compatible
   */
  async convertDiscordVideo(url: string): Promise<ConversionResult> {
    // Vérifier si c'est une URL Discord
    if (!this.isDiscordUrl(url)) {
      return {
        success: true,
        originalUrl: url,
        cached: false
      };
    }

    const cacheKey = this.generateCacheKey(url);
    
    // Vérifier le cache
    const cachedFile = await this.isCached(cacheKey);
    if (cachedFile) {
      console.log('💾 Utilisation du cache pour:', url);
      return {
        success: true,
        convertedUrl: `/client/api/media/${cacheKey}.mp4`,
        cached: true
      };
    }

    const tempInput = join(this.tempDir, `input-${Date.now()}.mp4`);
    const tempOutput = join(this.tempDir, `output-${Date.now()}.mp4`);
    const finalOutput = join(this.cacheDir, `${cacheKey}.mp4`);

    try {
      // 1. Télécharger le fichier
      const downloadSuccess = await this.downloadFile(url, tempInput);
      if (!downloadSuccess) {
        return {
          success: false,
          error: 'Échec du téléchargement',
          originalUrl: url
        };
      }

      // 2. Analyser les codecs
      const codecs = await this.analyzeVideoCodecs(tempInput);
      console.log('🔍 Codecs détectés:', codecs);

      // 3. Vérifier si conversion nécessaire
      if (codecs.audio === 'aac' && codecs.video === 'h264') {
        console.log('✅ Fichier déjà compatible, pas de conversion nécessaire');
        // Copier vers le cache
        await writeFile(finalOutput, await readFile(tempInput));
        
        // Nettoyer les fichiers temporaires
        await unlink(tempInput).catch(() => {});
        
        return {
          success: true,
          convertedUrl: `/client/api/media/${cacheKey}.mp4`,
          cached: false
        };
      }

      // 4. Convertir si nécessaire
      const convertSuccess = await this.convertVideo(tempInput, tempOutput);
      if (!convertSuccess) {
        return {
          success: false,
          error: 'Échec de la conversion',
          originalUrl: url
        };
      }

      // 5. Déplacer vers le cache
      await writeFile(finalOutput, await readFile(tempOutput));

      // 6. Nettoyer les fichiers temporaires
      await unlink(tempInput).catch(() => {});
      await unlink(tempOutput).catch(() => {});

      console.log('🎉 Conversion et mise en cache réussies');
      return {
        success: true,
        convertedUrl: `/client/api/media/${cacheKey}.mp4`,
        cached: false
      };

    } catch (error) {
      console.log('❌ Erreur générale conversion:', error);
      
      // Nettoyer en cas d'erreur
      await unlink(tempInput).catch(() => {});
      await unlink(tempOutput).catch(() => {});
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        originalUrl: url
      };
    }
  }

  /**
   * Nettoie le cache des fichiers anciens (plus de 24h)
   */
  async cleanOldCache(): Promise<void> {
    try {
      const { readdir, stat } = require('fs/promises');
      const files = await readdir(this.cacheDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24h

      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        const stats = await stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await unlink(filePath);
          console.log('🗑️ Fichier cache supprimé:', file);
        }
      }
    } catch (error) {
      console.log('⚠️ Erreur nettoyage cache:', error);
    }
  }
}

// Instance singleton
export const videoConverter = new VideoConverter();

// Nettoyage automatique du cache toutes les heures
setInterval(() => {
  videoConverter.cleanOldCache();
}, 60 * 60 * 1000);
