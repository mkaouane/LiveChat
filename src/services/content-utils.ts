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
    await writeFile(tempFile, Buffer.from(buffer));

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
  
  try {
    const apiUrl = `https://api.tiklydown.eu/api/download?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    // ... rest of API 1 code
  } catch (error) {
    console.log('✅ API 1 failed as expected, trying API 2...');
    try {
      const apiUrl2 = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl2);
      const data = await response.json();

      if (data.data && data.data.play) {
        
        // AJOUTEZ CES LIGNES MANQUANTES :
        const duration = await downloadAndGetDuration(data.data.play);
        return {
          contentType: 'video/mp4',
          mediaDuration: duration || data.data.duration || 30,
          directUrl: data.data.play,
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
