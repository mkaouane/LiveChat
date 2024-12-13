import fetch from 'node-fetch';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { fileTypeFromBuffer } from 'file-type';
import mime from 'mime-types';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

function getFileTypeWithRegex(url) {
  const regex = /(?:\.([^.]+))?$/; // Regular expression to capture file extension
  //@ts-ignore
  const extension = regex.exec(url)[1]; // Extract extension from URL
  return extension ? extension.toLowerCase() : 'No extension found';
}

const isTikTokUrl = (url: string): boolean => {
  return url.includes('tiktok.com');
};

async function downloadAndGetDuration(url: string): Promise<number | null> {
  const tempFile = join(tmpdir(), `tiktok-${Date.now()}.mp4`);
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await writeFile(tempFile, Buffer.from(buffer));
    
    const duration = await getVideoDurationInSeconds(tempFile);
    console.log(duration);
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
  try {
    const apiUrl = `https://api.tiklydown.eu/api/download?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.video) {
      // Essayer d'obtenir la durée réelle
      const duration = await downloadAndGetDuration(data.video);
      
      return {
        contentType: 'video/mp4',
        mediaDuration: duration || data.duration || 30,
        directUrl: data.video
      };
    }
  } catch (error) {
    try {
      const apiUrl2 = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl2);
      const data = await response.json();
      
      if (data.data && data.data.play) {
        // Essayer d'obtenir la durée réelle
        const duration = await downloadAndGetDuration(data.data.play);
        
        return {
          contentType: 'video/mp4',
          mediaDuration: duration || data.data.duration || 30,
          directUrl: data.data.play
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export const getContentInformationsFromUrl = async (url: string) => {
  let contentType;
  let mediaDuration;
  const directUrl = url;

  // Check if it's a TikTok URL first
  if (isTikTokUrl(url)) {
    const tiktokInfo = await getTikTokVideoInfo(url);
    if (tiktokInfo) {
      return {
        contentType: tiktokInfo.contentType,
        mediaDuration: tiktokInfo.mediaDuration,
        directUrl: tiktokInfo.directUrl,
      };
    }
  }

  // First try to get it with URL
  try {
    const fileExt = getFileTypeWithRegex(url);

    const tmpContentType = mime.lookup(fileExt);

    if (tmpContentType) {
      contentType = tmpContentType;
    }
  } catch (error) {}

  // If it doesn't work with URL, try with fetch
  try {
    if (!contentType) {
      const file = await fetch(url);

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
    mediaDuration = await getVideoDurationInSeconds(url);
  } catch (error) {}

  return { contentType, mediaDuration, directUrl };
};
