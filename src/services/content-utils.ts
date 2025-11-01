import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import fetch from 'node-fetch';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';

function getFileTypeWithRegex(url) {
  const regex = /(?:\.([^.]+))?$/; // Regular expression to capture file extension
  //@ts-ignore
  const extension = regex.exec(url)[1]; // Extract extension from URL
  return extension ? extension.toLowerCase() : 'No extension found';
}

const isTikTokUrl = (url: string): boolean => {
  return url.includes('tiktok.com');
};

const isTwitterUrl = (url: string): boolean => {
  return /(?:twitter\.com|x\.com)\//i.test(url);
};

function parseTwitterUrl(url: string): { screenName: string | null; tweetId: string | null } {
  try {
    const m = url.match(/(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/i);
    if (m) {
      return { screenName: m[1], tweetId: m[2] };
    }
  } catch {}
  return { screenName: null, tweetId: null };
}

// Fonction pour suivre les redirections TikTok et récupérer le vrai lien
async function resolveTikTokUrl(url: string): Promise<string> {
  try {
    console.log('🔗 Following TikTok redirect:', url);
    
    // Suivre la redirection
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow'
    });
    
    const finalUrl = response.url;
    console.log('✅ Final TikTok URL:', finalUrl);
    
    return finalUrl;
  } catch (error) {
    console.log('❌ Failed to follow redirect:', error);
    return url; // Retourner l'URL originale en cas d'erreur
  }
}

// const isYouTubeUrl = (url: string): boolean => {
//   return url.includes('youtube.com');
// };

const transformYouTubeUrl = (url: string): string => {
  // Check if it's a YouTube Shorts URL
  const shortsMatch = url.match(/youtube\.com\/shorts\/([^/?]+)/);
  if (shortsMatch) {
    return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
  }
  return url;
};

async function downloadAndGetDuration(url: string): Promise<number | null> {
  const tempFile = join(tmpdir(), `tiktok-${Date.now()}.mp4`);
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await writeFile(tempFile, new Uint8Array(buffer));

    const duration = await getVideoDurationInSeconds(tempFile);
    return duration;
  } catch (error) {
    return null;
  } finally {
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function getTikTokVideoInfo(url: string) {
  console.log('🔍 Processing TikTok URL:', url);
  
  // Résoudre l'URL TikTok (suivre les redirections pour les liens courts)
  const resolvedUrl = await resolveTikTokUrl(url);
  
  try {
    const apiUrl = `https://api.tiklydown.eu/api/download?url=${encodeURIComponent(resolvedUrl)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    // ... rest of API 1 code
  } catch (error) {
    console.log('✅ API 1 failed as expected, trying API 2...');
    try {
      const apiUrl2 = `https://www.tikwm.com/api/?url=${encodeURIComponent(resolvedUrl)}`;
      const response = await fetch(apiUrl2);
      const data = await response.json();

      const apiData = data as any;
      if (apiData.data && apiData.data.play) {
        // AJOUTEZ CES LIGNES MANQUANTES :
        const duration = await downloadAndGetDuration(apiData.data.play);
        return {
          contentType: 'video/mp4',
          mediaDuration: duration || apiData.data.duration || 30,
          directUrl: apiData.data.play,
        };
      } else {
        console.log('❌ No video data in API 2 response');
      }
    } catch (api2Error) {
      console.log('❌ API 2 failed:', api2Error);
      return null;
    }
  }
  return null;
}

async function getTwitterVideoInfo(url: string) {
  console.log('🔍 Processing Twitter URL:', url);

  const { screenName, tweetId } = parseTwitterUrl(url);
  if (!screenName || !tweetId) {
    console.log('❌ Unable to parse Twitter URL');
    return null;
  }

  const apiUrl = `https://api.vxtwitter.com/${encodeURIComponent(screenName)}/status/${encodeURIComponent(tweetId)}`;
  try {
    const res = await fetch(apiUrl);
    const data = (await res.json()) as any;

    // Prefer media_extended if present
    const ext = Array.isArray(data?.media_extended) ? data.media_extended : [];
    const firstVideo = ext.find((m: any) => m?.type === 'video' && m?.url);
    const mediaUrl = firstVideo?.url || (Array.isArray(data?.mediaURLs) ? data.mediaURLs[0] : undefined);

    if (mediaUrl) {
      const durationMs = firstVideo?.duration_millis;
      const duration = durationMs ? Math.ceil(durationMs / 1000) : undefined;
      return {
        contentType: 'video/mp4',
        mediaDuration: duration,
        directUrl: mediaUrl,
      };
    }
  } catch (e) {
    console.log('❌ Twitter API failed:', e);
  }
  return null;
}

export const getContentInformationsFromUrl = async (url: string) => {
  // Transform YouTube Shorts URL if needed
  const transformedUrl = transformYouTubeUrl(url);

  let contentType;
  let mediaDuration;
  const directUrl = transformedUrl;

  // Check if it's a TikTok URL first
  if (isTikTokUrl(transformedUrl)) {
    const tiktokInfo = await getTikTokVideoInfo(transformedUrl);
    if (tiktokInfo) {
      console.log('🎯 TikTok info returned:', {
        contentType: tiktokInfo.contentType,
        mediaDuration: tiktokInfo.mediaDuration,
        directUrl: tiktokInfo.directUrl
      });
      return {
        contentType: tiktokInfo.contentType,
        mediaDuration: tiktokInfo.mediaDuration,
        directUrl: tiktokInfo.directUrl,
      };
    } else {
      console.log('❌ TikTok info is null');
    }
  }

  // Check if it's a Twitter/X URL
  if (isTwitterUrl(transformedUrl)) {
    const twitterInfo = await getTwitterVideoInfo(transformedUrl);
    if (twitterInfo) {
      console.log('🎯 Twitter info returned:', {
        contentType: twitterInfo.contentType,
        mediaDuration: twitterInfo.mediaDuration,
        directUrl: twitterInfo.directUrl,
      });
      return {
        contentType: twitterInfo.contentType,
        mediaDuration: twitterInfo.mediaDuration,
        directUrl: twitterInfo.directUrl,
      };
    } else {
      console.log('❌ Twitter info is null');
    }
  }

  // First try to get it with URL
  try {
    const fileExt = getFileTypeWithRegex(transformedUrl);

    const tmpContentType = mime.lookup(fileExt);

    if (tmpContentType) {
      contentType = tmpContentType;
    }
  } catch (error) {}

  // If it doesn't work with URL, try with fetch
  try {
    if (!contentType) {
      const file = await fetch(transformedUrl);

      contentType = file.headers.get('Content-Type');

      if (!contentType) {
        const res = await fileTypeFromBuffer(await file.arrayBuffer());

        if (res) {
          contentType = res.mime;
        }
      }
    }
  } catch (error) {}

  try {
    mediaDuration = await getVideoDurationInSeconds(transformedUrl);
  } catch (error) {}

  return { contentType, mediaDuration, directUrl };
};
